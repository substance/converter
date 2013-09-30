"use strict";

var Document = require("substance-document");
var Annotator = Document.Annotator;
//var ExporterError = require("./converter_errors").ExporterError;

var _annotations = [
  ["Emph", "emphasis"],
  ["Strong", "strong"],
  ["Code","code"],
  ["Link","link"]
];

var mapAnnotationType = function(type) {
  for (var i = 0; i < _annotations.length; i++) {
    if (_annotations[i][1] === type) {
      return _annotations[i][0];
    }
  }

  return undefined;
};

var PandocExporter = function() {
};

PandocExporter.Prototype = function() {

  this.export = function(article) {
    var output = [];
    var meta = { "unMeta": {} };
    output.push(meta);

    var state = {};
    state.article = article;
    state.annotationIndex = Annotator.createIndex(article);

    var content = this.document(state);

    output.push(content);


    return output;
  };

  this.document = function(state) {
    var content = [];
    var nodes = state.article.query(["content", "nodes"]);

    for (var nodePos = 0; nodePos < nodes.length; nodePos++) {
      var node = nodes[nodePos];

      // recursive descent:
      if (node.type === "text") {
        content.push(this.paragraph(state, node));
      } else if (node.type === "heading") {
        content.push(this.heading(state, node));
      } else if (node.type == "codeblock") {
        content.push(this.codeblock(state, node));
      } else if (node.type == "image") {
        content.push(this.image(state, node));
      } else if (node.type == "figure") {
        content.push(this.figure(state, node));
      } else if (node.type == "list") {
        content.push(this.list(state, node));
      }
    }

    return content;
  };

  this.paragraph = function(state, node) {
    var annotations = state.annotationIndex.get(node.id);

    // recursive descent:
    var content = this.annotated_text(state, node.content, annotations);

    var output = {
      contents: content,
      tag: "Para"
    };

    return output;
  };

  this.plain = function(state, node) {
    var annotations = state.annotationIndex.get(node.id);

    // recursive descent:
    var content = this.annotated_text(state, node.content, annotations);

    var output = {
      contents: content,
      tag: "Plain"
    };

    return output;
  };

  this.heading = function(state, node) {
    var annotations = state.annotationIndex.get(node.id);

    var tag = node.content.toLowerCase().split(" ").join("-");
    var meta = [
      tag, [], []
    ];

    // recursive descent:
    var content = this.annotated_text(state, node.content, annotations);

    var output = {
      contents: [
        node.level,
        meta,
        content
      ],
      tag: "Header"
    };

    return output;
  };

  this.codeblock = function(state, node) {
    var content = node.content;

    var output = {
      contents: [
        [
          "",
          [],
          []
        ],
        content
      ],
      tag: "CodeBlock"
    };

    return output;
  };

  this.image = function(state, node) {
    var output = {
      contents: [
        {
          tag: "Image",
          contents: [
            [
              {
                contents: [],
                tag: "Str"
              },
            ],
            [
              node.url,
              "fig:"
            ]
          ]
        }
      ],
      tag: "Para"
    };

    return output;
  };

  this.figure = function(state, node) {
    var caption;
    if (node.caption !== '') {
      var p = this.paragraph(state, node.getCaption());
      caption = p.contents;
    } else {
      caption = [
        {
          contents: [],
          tag: "Str"
        }
      ];
    }

    var url = node.url;
    var output = {
      contents: [
        {
          contents: [
            caption,
            [
              url,
              "fig:"
            ]
          ],
          tag: "Image"
        }
      ],
      tag: "Para"
    };

    return output;
  };

  this.list = function(state,node) {
    var listItems = [];
    if (node.items != []) {
      var items = node.getItems();
      for (var i = 0; i < node.items.length; i++) {
        var content = this.plain(state, items[i]);
        listItems.push([content]);
      }
    }
    var output;
    if (node.properties.ordered) {
      output = {
        tag: "OrderedList",
        contents: [
          [1,"Decimal","Period"],
          listItems
        ]
      };
    } else {
      output = {
        tag: "BulletList",
        contents: listItems
      };
    }
    return output;
  };

  this.annotated_text = function(state, text, annotations) {

    var rootContext = {
      tag: "ROOT",
      contents: []
    };

    var fragmenter = new Annotator.Fragmenter({
      levels : {
        "emphasis" : 1,
        "strong": 1,
        "code": 1,
        "link": 1
      }
    });

    fragmenter.onText = function(context, text) {
      var type = context.tag;

      if (type === 'Code') {
        // do not split the text
        context.contents.push(text);
        return;
      }

      var container = context.contents;
      if (type === 'Link') {
        container = container[0];
      }

      var words = text.split(" ");
      for (var i = 0; i < words.length; i++) {
        if (i > 0) {
          container.push({
            contents: [],
            tag: "Space"
          });
        }
        // Note: trailing spaces produce empty elements by the word split
        // so we ignore such pieces
        if (words[i].length > 0) {
          container.push({
            contents: words[i],
            tag: "Str"
          });
        }
      }
    };

    fragmenter.onEnter = function(entry, parentContext) {
      var name = mapAnnotationType(entry.type);

      if (name === undefined) {
        return parentContext;
      }

      var annotation = {
        tag: name,
        contents: []
      };

      // I would say that this isn't simpleness solution,
      // we need to something more compact with code and links
      if (name == 'Link') {
        annotation.contents = [
          [],
          [
            state.article.get([entry.id,'url']),
            ""
          ]
        ];
      } else if (name == 'Code') {
        annotation.contents = [
          [ "", [], [] ]
        ];
      }

      parentContext.contents.push(annotation);

      return annotation;
    };

    fragmenter.start(rootContext, text, annotations);

    return rootContext.contents;
  };

};

PandocExporter.prototype = new PandocExporter.Prototype();

module.exports = PandocExporter;
