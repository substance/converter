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
    var meta = {
      "docTitle": [],//[article.title],
      "docAuthors": [],//[article.creator],
      "docDate": []//[article.created_at]
    };

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
      "Para": content
    };

    return output;
  };

  this.plain = function(state, node) {
    var annotations = state.annotationIndex.get(node.id);

    // recursive descent:
    var content = this.annotated_text(state, node.content, annotations);

    var output = {
      "Plain": content
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
      "Header": [
        node.level,
        meta,
        content
      ]
    };

    return output;
  };

  this.codeblock = function(state, node) {
    var content = node.content;

    var output = {
      "CodeBlock": [
        [
          "",
          [],
          []
        ],
        content
      ]
    };

    return output;
  };

  this.image = function(state, node) {
    var output = {
      "Para": [
        {
          "Image": [
            { "Para": [] },
            [
              node.url,
              "fig:"
            ]
          ]
        }
      ]
    };

    return output;
  };

  this.figure = function(state, node) {
    var content;
    if (node.caption !== '') {
      content = this.paragraph(state, node.getCaption());
    } else {
      content = { "Para": [] };
    }
    var img = node.getImage();
    var output = {
      "Para": [
        {
          "Image": [
            content.Para,
            [
              img.url,
              "fig:"
            ]
          ]
        }
      ]
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
        "OrderedList": [
          [1,"Decimal","Period"],
          listItems
        ]
      };
    } else {
      output = {
        "BulletList": listItems
      };
    }
    return output;
  };

  this.annotated_text = function(state, text, annotations) {

    var fragments = [];

    var fragmenter = new Annotator.Fragmenter({
      levels : {
        "emphasis" : 1,
        "strong": 1,
        "code": 1,
        "link": 1
      }
    });

    fragmenter.onText = function(context, text) {
      // I would say that this isn't simpleness solution,
      // we need to something more compact with code and links
      if (context[0] == 'Link') {
        context[0] = [];
        context = context[0];
      }

      if (context[0] == 'Code') {
        context.shift();
        context.push(text);
      } else {
        var words = text.split(" ");
        for (var i = 0; i < words.length; i++) {
          if (i > 0) {
            context.push("Space");
          }
          // Note: trailing spaces produce empty elements by the word split
          // Punctuation?
          if (words[i].length > 0) {
            context.push({
              "Str": words[i]
            });
          }
        }
      }
    };

    fragmenter.onEnter = function(entry, parentContext) {
      var name = mapAnnotationType(entry.type);

      if (name === undefined) {
        return parentContext;
      }

      var annotation = {};
      annotation[name] = [];

      // I would say that this isn't simpleness solution,
      // we need to something more compact with code and links
      if (name == 'Link') {
        annotation[name] = [
          'Link',
          [
            state.article.get([entry.id,'url']),
            ""
          ]
        ];
      } else if (name == 'Code') {
        annotation[name] = [
          "Code",
          [
            "",
            [],
            []
          ]
        ];
      }

      parentContext.push(annotation);

      return annotation[name];
    };
    fragmenter.start(fragments, text, annotations);
    return fragments;
  };

};

PandocExporter.prototype = new PandocExporter.Prototype();

module.exports = PandocExporter;
