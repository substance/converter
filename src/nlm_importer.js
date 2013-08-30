
var _ = require("underscore");
var util = require("substance-util");
var ImporterError = require("./converter_errors").ImporterError;

var NLMImporter = function() {

};

NLMImporter.Prototype = function() {

  // Helper functions
  // --------

  // ### Creates a concrete Document instance

  this.createDocument = function() {
    var Article = require("substance-article");
    var doc = new Article();

    return doc;
  };

  // ### Adds top-level Nodes into views.

  this.show = function(state, nodes) {
    var doc = state.doc;
    var view = doc.get("content").nodes;

    // show the created nodes in the content view
    for (var j = 0; j < nodes.length; j++) {
      view.push(nodes[j].id);
    }
  };

  this.getNodeType = function(el) {
    if (el.nodeType === Node.TEXT_NODE) {
      return "text";
    } else {
      return el.tagName.toLowerCase();
    }
  };

  // ### The main entry point for starting an import

  this.import = function(input) {
    var xmlDoc;

    // Note: when we are using jqueries get("<file>.xml") we
    // magically get a parsed XML document already
    if (_.isString(input)) {
      var parser = new DOMParser();
      xmlDoc = parser.parseFromString(input,"text/xml");
    } else {
      xmlDoc = input;
    }

    // Creating the output Document via factore, so that it is possible to
    // create specialized NLMImporter later which would want to instantiate
    // a specialized Document type
    var doc = this.createDocument();

    // A deliverable state which makes this importer stateless
    var state = new NLMImporter.State(xmlDoc, doc);

    // Note: all other methods are called corresponding
    return this.document(state, xmlDoc);
  };

  // Parser
  // --------
  // These methods are used to process XML elements in
  // using a recursive-descent approach.


  // ### Top-Level function that takes a full NLM tree
  // Note: a specialized converter can derive this method and
  // add additional pre- or post-processing.

  this.document = function(state, xmlDoc) {
    var doc = state.doc;

    var article = xmlDoc.querySelector("article");

    if (!article) {
      throw new ImporterError("Expected to find an 'article' element.");
    }

    // recursive-descent:

    this.article(state, article);

    // post-processing:

    // Creating the annotations afterwards, to make sure
    // that all referenced nodes are available
    for (var i = 0; i < state.annotations.length; i++) {
      doc.create(state.annotations[i]);
    }

    // Rebuild views to ensure consistency
    _.each(doc.views, function(view) {
      doc.get(view).rebuild();
    });

    return doc;
  };

  // Article
  // --------
  // Does the actual conversion.
  //
  // Note: this is implemented as lazy as possible (ALAP) and will be extended as demands arise.
  // We have left a comment where we skipped an element found in the spec.
  //
  // If you need such an element supported:
  //  - add a stub to this class (empty body),
  //  - add code to call the method to the appropriate function,
  //  - and implement it the handler here or in your converter.
  //
  // This makes this class become a shared abstract converter.

  this.article = function(state, article) {

    var front = article.querySelector("front");
    if (!front) {
      throw new ImporterError("Expected to find a 'front' element.");
    } else {
      this.front(state, front);
    }

    var body = article.querySelector("body");
    if (body) {
      this.body(state, body);
    }

    var back = article.querySelector("back");
    if (back) {
      this.back(state, back);
    }

    // Not supported yet:
    // <floats-group> Floating Element Group, zero or one
    // <sub-article> Sub-article, zero or more
    // <response> Response, zero or more
  };

  // ### Article.Front
  //

  this.front = function(state, front) {

    // Not supported yet:
    // <journal-meta> Journal Metadata

    // <article-meta> Article Metadata
    var articleMeta = front.querySelector("article-meta");
    if (!articleMeta) {
      throw new ImporterError("Expected element: 'article-meta'");
    }
    this.articleMeta(state, articleMeta);

    // Not supported yet:
    // <notes> Notes, zero or one
  };

  // #### Front.ArticleMeta
  //

  this.articleMeta = function(state, articleMeta) {

    // <article-id> Article Identifier, zero or more
    var articleIds = articleMeta.querySelectorAll("article-id");
    this.articleIds(state, articleIds);

    // Not supported yet:
    // <article-categories> Article Grouping Data, zero or one

    // <title-group> Title Group, zero or one
    var titleGroup = articleMeta.querySelector("title-group");
    if (titleGroup) {
      this.titleGroup(state, titleGroup);
    }

    // TODO: the spec says, that there may be any combination of
    // 'contrib-group', 'aff', 'aff-alternatives', and 'x'
    // However, in the articles seen so far, these were sub-elements of 'contrib-group', which itself was single
    var contribGroup = articleMeta.querySelector("contrib-group");
    if (contribGroup) {
      this.contribGroup(state, contribGroup);
    }

    // Not supported yet:
    // <author-notes> Author Note Group, zero or one

    // <pub-date> Publication Date, zero or more
    var pubDates = articleMeta.querySelectorAll("pub-date");
    this.pubDates(state, pubDates);

    // Not supported yet:
    // <volume> Volume Number, zero or one
    // <volume-id> Volume Identifier, zero or more
    // <volume-series> Volume Series, zero or one • <issue> Issue Number, zero or more
    // <issue-id> Issue Identifier, zero or more
    // <issue-title> Issue Title, zero or more
    // <issue-sponsor> Issue Sponsor, zero or more
    // <issue-part> Issue Part, zero or one
    // <isbn> ISBN, zero or more
    // <supplement> Supplement Information, zero or one
    // Optionally any one of:
    //   * The following, in order:
    //     - Optionally, the following sequence (in order):
    //       . <fpage> First Page
    //       . <lpage> Last Page, zero or one
    //     - <page-range> Page Ranges, zero or one
    //   * <elocation-id> Electronic Location Identifier
    // Any combination of:
    //    * Linking Elements
    //      - <email> Email Address
    //      - <ext-link> External Link
    //      - <uri> Uniform Resource Identifier (URI)
    //    * <product> Product Information
    //    * <supplementary-material> Supplementary Material
    // <history> History: Document History, zero or one
    // <permissions> Permissions, zero or one
    // <self-uri> URI for This Same Article Online, zero or more
    // Any combination of:
    //   * <related-article> Related Article Information
    //   * <related-object> Related Object Information

    // <abstract> Abstract, zero or more
    var abs = articleMeta.querySelector("abstract");
    if (abs) {
      this.abstract(state, abs);
    }

    // Not supported yet:
    // <trans-abstract> Translated Abstract, zero or more
    // <kwd-group> Keyword Group, zero or more
    // <funding-group> Funding Group, zero or more
    // <conference> Conference Information, zero or more
    // <counts> Counts, zero or one
    // <custom-meta-group> Custom Metadata Group, zero or one

  };

  // articleIds: array of <article-id> elements
  this.articleIds = function(state, articleIds) {
    var doc = state.doc;

    // Note: Substance.Article does only support one id
    if (articleIds.length > 0) {
      doc.id = articleIds[0].textContent;
    } else {
      // if no id was set we create a random one
      doc.id = util.uuid();
    }
  };

  this.titleGroup = function(state, titleGroup) {
    var doc = state.doc;

    var articleTitle = titleGroup.querySelector("article-title");
    if (articleTitle) {
      doc.title = articleTitle.textContent;
    }

    // Not yet supported:
    // <subtitle> Document Subtitle, zero or one
  };

  // Note: Substance.Article supports only one author.
  // We use the first author found in the contribGroup for the 'creator' property.
  this.contribGroup = function(state, contribGroup) {
    var doc = state.doc;

    function _getAuthor(contribGroup) {
      var contribs = contribGroup.querySelectorAll("contrib");
      if (contribs) {
        for (var i = 0; i < contribs.length; i++) {
          var contrib = contribs[i];
          if (contrib.getAttribute("contrib-type") === "author") {
            var name = contrib.querySelector("name");
            var surname = name.querySelector("surname").textContent;
            var givenNames = name.querySelector("given-names").textContent;
            return givenNames + " " + surname;
          }
        }
      }
      return "";
    }

    var creator = _getAuthor(contribGroup);
    doc.creator = creator;
  };

  // Note: Substance.Article supports no publications directly.
  // We use the first pub-date for created_at
  this.pubDates = function(state, pubDates) {
    var doc = state.doc;
    if (pubDates.length > 0) {
      var converted = this.pubDate(state, pubDates[0]);
      doc.created_at = converted.date;
    }
  };

  // Note: this does not follow the spec but only takes the parts as it was necessary until now
  // TODO: implement it thoroughly
  this.pubDate = function(state, pubDate) {
    var day = -1;
    var month = -1;
    var year = -1;
    _.each(pubDate.children, function(el) {
      var type = this.getNodeType(el);

      var value = el.textContent;
      if (type === "day") {
        day = parseInt(value, 10);
      } else if (type === "month") {
        month = parseInt(value, 10);
      } else if (type === "year") {
        year = parseInt(value, 10);
      }
    }, this);
    var date = new Date(year, month, day);
    return {
      date: date
    };
  };

  // Note: This is *very* rudimentary considering the actual spec for 'abstract' (which is rather complex)
  this.abstract = function(state, abs) {
    var doc = state.doc;

    // TODO: extend this when we support more content
    var children = abs.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = this.getNodeType(child);
      if (type === "p") {
        doc.abstract = child.textContent;
        return;
      }
    }
  };

  // ### Article.Body
  //

  /*
  • Any combination of:
    ◦ <boxed-text> Boxed Text
    ◦ <chem-struct-wrap> Chemical Structure Wrapper
    ◦ <fig> Figure
    ◦ <graphic> Graphic
    ◦ <media> Media Object
    ◦ <preformat> Preformatted Text
    ◦ <supplementary-material> Supplementary Material ◦ <table-wrap> Table Wrapper
    ◦ <disp-formula> Formula, Display
    ◦ <disp-formula-group> Formula, Display Group
    ◦ <def-list> Definition List
    ◦ <list> List
    ◦ <p> Paragraph
    ◦ <disp-quote> Quote, Displayed
    ◦ <speech> Speech
    ◦ <statement> Statement, Formal
    ◦ <verse-group> Verse Form for Poetry
  • <sec> Section, zero or more
  */
  this.body = function(state, body) {

    var nodes = this.bodyNodes(state, body.children);

    if (nodes.length > 0) {
      this.show(state, nodes);
    }

  };

  this.bodyNodes = function(state, children, startIndex) {
    var nodes = [];

    startIndex = startIndex || 0;

    for (var i = startIndex; i < children.length; i++) {
      var child = children[i];
      var type = this.getNodeType(child);

      if (type === "p") {
        nodes = nodes.concat(this.paragraph(state, child));
      }
      else if (type === "sec") {
        nodes = nodes.concat(this.section(state, child));
      }
      else if (type === "fig") {
        nodes.push(this.figure(state, child));
      }
      else if (type === "fig-group") {
        nodes = nodes.concat(this.figGroup(state, child));
      }
      else if (type === "list") {
        nodes.push(this.list(state, child));
      }
      else {
        throw new ImporterError("Node not yet supported within section: " + type);
      }
    }

    return nodes;
  };

  this.section = function(state, section) {

    // pushing the section level to track the level for nested sections
    state.sectionLevel++;

    var doc = state.doc;
    var children = section.children;

    // create a heading
    var title = children[0];
    var heading = {
      id: state.nextId("heading"),
      type: "heading",
      level: state.sectionLevel,
      content: title.textContent
    };
    doc.create(heading);

    // Recursive Descent: get all section body nodes
    var nodes = this.bodyNodes(state, children, 1);

    // add the heading at the front
    nodes.unshift(heading);

    // popping the section level
    state.sectionLevel--;

    return nodes;
  };

  // A 'paragraph' is given a '<p>' ta
  this.paragraph = function(state, paragraph) {
    var doc = state.doc;

    // Note: there are some elements in the NLM paragraph allowed
    // which are not allowed in a Substance Paragraph.
    // I.e., they can not be nested inside, but must be added on top-level

    var nodes = [];

    var iterator = {
      childNodes: paragraph.childNodes,
      length: paragraph.childNodes.length,
      pos: 0
    };

    for (; iterator.pos < iterator.length; iterator.pos++) {
      var child = iterator.childNodes[iterator.pos];
      var type = this.getNodeType(child);

      if (type === "text" || this.isAnnotation(type)) {
        var node = {
          id: state.nextId("paragraph"),
          type: "paragraph",
          content: ""
        };
        // pushing information to the stack so that annotations can be created appropriately
        state.stack.push({
          node: node,
          path: [node.id, "content"]
        });

        // Note: this will consume as many textish elements (text and annotations)
        // but will return when hitting the first un-textish element.
        // In that case, the iterator will still have more elements
        // and the loop is continued
        var annotatedText = this.annotatedText(state, iterator, 0);

        node.content = annotatedText;
        doc.create(node);
        nodes.push(node);

        // popping the stack
        state.stack.pop();
      }
      else if (type === "fig") {
        nodes.push(this.figure(state, child));
      }
      else if (type === "fig-group") {
        nodes = nodes.concat(this.figGroup(state, child));
      }
      else if (type === "table-wrap") {
        console.log("Paragraph level: table-wrap");
      }
      else if (type === "list") {
        nodes.push(this.list(state, child));
      }
      else {
        throw new ImporterError("Not yet supported on paragraph level: " + type);
      }
    }

    return nodes;
  };

  this.list = function(state, list) {
    var doc = state.doc;

    var listNode = {
      "id": state.nextId("list"),
      "type": "list",
      "items": [],
      "ordered": false
    };

    // TODO: better detect ordererd list types (need examples)
    if (list.getAttribute("list-type") === "ordered") {
      listNode.ordered = true;
    }

    var listItems = list.querySelectorAll("list-item");
    for (var i = 0; i < listItems.length; i++) {
      var listItem = listItems[i];
      // Note: we do not care much about what is served as items
      // However, we do not have complex nodes on paragraph level
      // They will be extract as sibling items
      var nodes = this.bodyNodes(state, listItem.children, 0);
      for (var j = 0; j < nodes.length; j++) {
        listNode.items.push(nodes[j].id);
      }
    }

    doc.create(listNode);

    return listNode;
  };

  // Ignored annotations:
  //  - <overline> Overline
  //  - <roman> Roman
  //  - <sans-serif> Sans Serif
  //  - <sc> Small Caps
  //  - <strike> Strike Through
  //  - <underline> Underline

  var _annotationTypes = {
    "bold": "strong",
    "italic": "emphasis",
    "monospace": "code",

    // Note: mapping unsupported annotation types to other types (for development)
    "xref": "idea",
    "sub": "code",
    "sup": "code",
    "underline": "strong",
  };

  this.isAnnotation = function(type) {
    return _annotationTypes[type] !== undefined;
  };

  this.annotatedText = function(state, iterator, charPos, nested) {
    var plainText = "";

    for (; iterator.pos < iterator.length; iterator.pos++) {
      var el = iterator.childNodes[iterator.pos];

      // Plain text nodes...
      if (el.nodeType === Node.TEXT_NODE) {
        plainText += el.textContent;
        charPos += el.textContent.length;
      }

      // Annotations...
      else {

        var type = this.getNodeType(el);
        if (this.isAnnotation(type)) {

          var start = charPos;

          var childIterator = {
            childNodes: el.childNodes,
            length: el.childNodes.length,
            pos: 0
          };

          // recurse into the annotation element to collect nested annotations
          // and the contained plain text
          var annotatedText = this.annotatedText(state, childIterator, charPos, "nested");

          plainText += annotatedText;
          charPos += annotatedText.length;

          this.createAnnotation(state, el, start, charPos);
        }

        // Unsupported...
        else {
          if (nested) {
            throw new ImporterError("Node not yet supported in annoted text: " + type);
          }
          else {
            // on paragraph level other elements can break a text block
            // we shift back the position and finish this call
            iterator.pos--;
            break;
          }
        }
      }
    }

    return plainText;
  };

  this.figure = function(state, figure) {
    var doc = state.doc;

    var figureNode = {
      type: "figure",
      image: null,
      caption: null
    };
    var id = figure.getAttribute("id") || state.nextId(figureNode.type);
    figureNode.id = id;

    // Caption: is a paragraph
    var caption = figure.querySelector("caption");
    if (caption) {
      var p = caption.querySelector("p");
      var nodes = this.paragraph(state, p);
      if (nodes.length > 1) {
        // Hmmm... what to do if the captions is a wild beast instead of a single paragraph?
        throw new ImporterError("Ooops. Not ready for that...");
      }
      figureNode.caption = nodes[0].id;
    }

    // Image
    // (... a first rough sketch)
    // TODO: implement it following the specification
    var graphic = figure.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    var img = {
      id: state.nextId("image"),
      type: "image",
      url: url
    };
    doc.create(img);
    figureNode.image = img.id;

    doc.create(figureNode);

    return figureNode;
  };

  // Note: fig-groups are not yet mapped to a dedicated node
  // Instead the contained figures are added flattened.
  this.figGroup = function(state, figGroup) {
    var nodes = [];
    var figs = figGroup.querySelectorAll("fig");

    for (var i = 0; i < figs.length; i++) {
      nodes.push(this.figure(state, figs[i]));
    }

    return nodes;
  };

  // Creates an annotation for a given annotation element
  // Note: annotations are not created instantly but stored into the state
  // to make sure, that the referenced node already exists.
  // The referenced node does not exist at the moment this method gets called
  // as it is right in the middle of processing it.
  this.createAnnotation = function(state, el, start, end) {
    var type = this.getNodeType(el);
    var annoType = _annotationTypes[type];
    var anno = {
      id: state.nextId(annoType),
      type : annoType,
      path: _.last(state.stack).path,
      range: [start, end],
    };
    state.annotations.push(anno);
  };

  // #### Article.Back
  // Contains things like references, notes, etc.
  this.back = function(state, back) {
    var refList = back.querySelector("ref-list");
    if (refList) {
      this.refList(state, refList);
    }
  };

  // Not supported yet in Substance.Article
  this.refList = function(/*state, refList*/) {
  };

};
NLMImporter.prototype = new NLMImporter.Prototype();

NLMImporter.State = function(xmlDoc, doc) {
  // the input xml document
  this.xmlDoc = xmlDoc;

  // the output substance document
  this.doc = doc;

  // store annotations to be created here
  // they will be added to the document when everything else is in place
  this.annotations = [];

  // when recursing into sub-nodes it is necessary to keep the stack
  // of processed nodes to be able to associate other things (e.g., annotations) correctly.
  this.stack = [];

  this.sectionLevel = 0;

  // an id generator for different types
  var ids = {};
  this.nextId = function(type) {
    ids[type] = ids[type] || 0;
    ids[type]++;
    return type +"_"+ids[type];
  };

};

module.exports = NLMImporter;
