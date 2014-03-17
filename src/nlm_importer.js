
var _ = require("underscore");
var util = require("substance-util");
var ImporterError = require("./converter_errors").ImporterError;
var DOMParser = window.DOMParser;

var NLMImporter = function() {};

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
  //
  // If you need such an element supported:
  //  - add a stub to this class (empty body),
  //  - add code to call the method to the appropriate function,
  //  - and implement the handler here if it can be done in general way
  //    or in your specialized importer.

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
  };

  // ### Article.Front
  //

  this.front = function(state, front) {

    // <article-meta> Article Metadata
    var articleMeta = front.querySelector("article-meta");
    if (!articleMeta) {
      throw new ImporterError("Expected element: 'article-meta'");
    }
    this.articleMeta(state, articleMeta);

  };

  // #### Front.ArticleMeta
  //

  this.articleMeta = function(state, articleMeta) {

    // <article-id> Article Identifier, zero or more
    var articleIds = articleMeta.querySelectorAll("article-id");
    this.articleIds(state, articleIds);

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

    // <pub-date> Publication Date, zero or more
    var pubDates = articleMeta.querySelectorAll("pub-date");
    this.pubDates(state, pubDates);

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
    _.each(util.dom.getChildren(pubDate), function(el) {
      var type = util.dom.getNodeType(el);

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
    var children = util.dom.getChildren(abs);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = util.dom.getNodeType(child);
      if (type === "p") {
        doc.abstract = child.textContent;
        return;
      }
    }
  };

  // ### Article.Body
  //

  this.body = function(state, body) {
    var nodes = this.bodyNodes(state, util.dom.getChildren(body));
    if (nodes.length > 0) {
      this.show(state, nodes);
    }
  };

  // Top-level elements as they can be found in the body or
  // in a section.
  this.bodyNodes = function(state, children, startIndex) {
    var nodes = [];

    startIndex = startIndex || 0;

    for (var i = startIndex; i < children.length; i++) {
      var child = children[i];
      var type = util.dom.getNodeType(child);
      var node;

      if (type === "p") {
        nodes = nodes.concat(this.paragraphGroup(state, child));
      }
      else if (type === "sec") {
        nodes = nodes.concat(this.section(state, child));
      }
      else if (type === "list") {
        node = this.list(state, child);
        if (node) nodes.push(node);
      }
      else if (type === "fig") {
        node = this.figure(state, child);
        if (node) nodes.push(node);
      }
      else if (type === "fig-group") {
        nodes = nodes.concat(this.figGroup(state, child));
      }
      else if (type === "table-wrap") {
        node = this.tableWrap(state, child);
        if (node) nodes.push(node);
      }
      else if (type === "disp-formula") {
        node = this.formula(state, child);
        if (node) nodes.push(node);
      }
      else if (type === "media") {
        node = this.media(state, child);
        if (node) nodes.push(node);
      }
      else if (type === "comment") {
        // Note: Maybe we could create a Substance.Comment?
        // Keep it silent for now
        // console.error("Ignoring comment");
      }
      else {
        console.error("Node not yet supported within section: " + type);
        // throw new ImporterError("Node not yet supported within section: " + type);
      }
    }

    return nodes;
  };

  this.section = function(state, section) {

    // pushing the section level to track the level for nested sections
    state.sectionLevel++;

    var doc = state.doc;
    var children = util.dom.getChildren(section);

    // create a heading
    var title = children[0];
    var heading = {
      id: state.nextId("heading"),
      source_id: section.getAttribute("id"),
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

  this.ignoredParagraphElements = {
    "comment": true,
    "supplementary-material": true,
  };

  this.acceptedParagraphElements = {
    "list": { handler: "list" },
    "fig": { handler: "figure" },
    "fig-group": { handler: "figGroup" },
    "table-wrap": { handler: "tableWrap" },
    "disp-formula": { handler: "formula" },
    "media": { handler: "media" }
  };

  // Segments children elements of a NLM <p> element
  // into blocks grouping according to following rules:
  // - "text", "inline-graphic", "inline-formula", and annotations
  // - ignore comments, supplementary-materials
  // - others are treated as singles
  this.segmentParagraphElements = function(paragraph) {
    var blocks = [];
    var lastType = "";
    var iterator = new util.dom.ChildNodeIterator(paragraph);

    // first fragment the childNodes into blocks
    while (iterator.hasNext()) {
      var child = iterator.next();
      var type = util.dom.getNodeType(child);

      // paragraph elements
      if (type === "text" || this.isAnnotation(type) || type === "inline-graphic") {
        if (lastType !== "paragraph") {
          blocks.push({ handler: "richParagraph", nodes: [] });
          lastType = "paragraph";
        }
        _.last(blocks).nodes.push(child);
        continue;
      }

      // ignore some elements
      if (this.ignoredParagraphElements[type]) {
        // skip
      }
      // other elements are treated as single blocks
      else if (this.acceptedParagraphElements[type]) {
        blocks.push(_.extend({node: child}, this.acceptedParagraphElements[type]));
      }
      lastType = type;
    }
    return blocks;
  };

  // A 'paragraph' is given a '<p>' tag
  // An NLM <p> can contain nested elements that are represented flattened in a Substance.Article
  // Hence, this function returns an array of nodes
  this.paragraphGroup = function(state, paragraph) {
    var nodes = [];

    // Note: there are some elements in the NLM paragraph allowed
    // which are flattened here. To simplify further processing we
    // segment the children of the paragraph elements in blocks
    var blocks = this.segmentParagraphElements(paragraph);

    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var node;
      if (block.handler === "richParagraph") {
        node = this.richParagraph(state, block.nodes);
        node.source_id = paragraph.getAttribute("id");
      } else {
        node = this[block.handler](state, block.node);
      }
      if (node) nodes.push(node);
    }

    return nodes;
  };

  this.richParagraph = function(state, children) {
    var doc = state.doc;

    var node = {
      id: state.nextId("richparagraph"),
      type: "richparagraph",
      children: null
    };
    var nodes = [];

    var iterator = new util.dom.ChildNodeIterator(children);
    while (iterator.hasNext()) {
      var child = iterator.next();
      var type = util.dom.getNodeType(child);

      // annotated text node
      if (type === "text" || this.isAnnotation(type)) {
        var textNode = {
          id: state.nextId("paragraph"),
          type: "paragraph",
          content: null
        };
        // pushing information to the stack so that annotations can be created appropriately
        state.stack.push({
          node: textNode,
          path: [textNode.id, "content"]
        });
        // Note: this will consume as many textish elements (text and annotations)
        // but will return when hitting the first un-textish element.
        // In that case, the iterator will still have more elements
        // and the loop is continued
        // Before descending, we reset the iterator to provide the current element again.
        var annotatedText = this.annotatedText(state, iterator.back(), 0);

        // Ignore empty paragraphs
        if (!util.isEmpty(annotatedText)) {
          textNode.content = annotatedText;
          doc.create(textNode);
          nodes.push(textNode);
        }

        // popping the stack
        state.stack.pop();
      }

      // inline image node
      else if (type === "inline-graphic") {
        var url = child.getAttribute("xlink:href");
        var img = {
          id: state.nextId("image"),
          type: "image",
          url: url
        };
        doc.create(img);
        nodes.push(img);
      }

      else if (type === "inline-formula") {
        console.error("Not supported yet");
      }
    }

    // if there is only a single node, return do not create a rich paragraph around it
    if (nodes.length < 2) {
      return nodes[0];
    } else {
      node.children = _.map(nodes, function(n) { return n.id; } );
      doc.create(node);
      return node;
    }
  };

  this.list = function(state, list) {
    var doc = state.doc;

    var listNode = {
      "id": state.nextId("list"),
      "source_id": list.getAttribute("id"),
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
      var nodes = this.bodyNodes(state, util.dom.getChildren(listItem), 0);
      for (var j = 0; j < nodes.length; j++) {
        listNode.items.push(nodes[j].id);
      }
    }

    doc.create(listNode);

    return listNode;
  };

  this.figure = function(state, figure) {
    var doc = state.doc;

    var figureNode = {
      id: state.nextId("figure"),
      source_id: figure.getAttribute("id"),
      type: "figure",
      image: null,
      caption: null
    };

    // Caption: is a paragraph
    var caption = figure.querySelector("caption");
    if (caption) {
      var p = caption.querySelector("p");
      var nodes = this.paragraphGroup(state, p);
      if (nodes.length > 1) {
        // Hmmm... what to do if the captions is a wild beast instead of a single paragraph?
        throw new ImporterError("Ooops. Not ready for that...");
      }
      figureNode.caption = nodes[0].id;
    }

    // Image
    // TODO: implement it more thoroughly
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

  // Not supported in Substance.Article
  this.media = function(/*state, media*/) {
    console.error("Not implemented: <media>.");
  };

  // Not supported in Substance.Article
  this.tableWrap = function(/*state, tableWrap*/) {
    console.error("Not implemented: <table-wrap>.");
  };

  // Not supported in Substance.Article
  this.formula = function(/*state, dispFormula*/) {
    console.error("Not implemented: <disp-formula>.");
  };

  // Article.Back
  // --------
  // Contains things like references, notes, etc.

  this.back = function(state, back) {
    var refList = back.querySelector("ref-list");
    if (refList) {
      this.refList(state, refList);
    }
  };

  // Not supported yet in Substance.Article
  this.refList = function(/*state, refList*/) {
    console.error("Not implemented: <ref-list>.");
  };

  // Annotations
  // --------

  var _annotationTypes = {
    "bold": "strong",
    "italic": "emphasis",
    "monospace": "code",
    "ext-link": "link",

    // Note: mapping unsupported annotation types to other types (for development)
    "xref": "idea",
    "sub": "code",
    "sup": "code",
    "underline": "strong",
  };

  this.isAnnotation = function(type) {
    return _annotationTypes[type] !== undefined;
  };

  // TODO: instead of breaking, we could segment the elements in advance
  this.annotatedText = function(state, iterator, charPos, nested) {
    var plainText = "";

    if (charPos === undefined) {
      charPos = 0;
    }

    while(iterator.hasNext()) {
      var el = iterator.next();
      // Plain text nodes...
      if (el.nodeType === window.Node.TEXT_NODE) {
        plainText += el.textContent;
        charPos += el.textContent.length;
      }
      // Annotations...
      else {
        var type = util.dom.getNodeType(el);
        if (this.isAnnotation(type)) {
          var start = charPos;
          // recurse into the annotation element to collect nested annotations
          // and the contained plain text
          var childIterator = new util.dom.ChildNodeIterator(el);
          var annotatedText = this.annotatedText(state, childIterator, charPos, "nested");
          plainText += annotatedText;
          charPos += annotatedText.length;
          this.createAnnotation(state, el, start, charPos);
        }
        // Unsupported...
        else {
          if (nested) {
            throw new ImporterError("Node not yet supported in annoted text: " + type);
          } else {
            // on paragraph level other elements can break a text block
            // we shift back the position and finish this call
            iterator.back();
            break;
          }
        }
      }
    }
    return plainText;
  };

  // Creates an annotation for a given annotation element
  // Note: annotations are not created instantly but stored into the state
  // to make sure, that the referenced node already exists.
  // The referenced node does not exist at the moment this method gets called
  // as it is right in the middle of processing it.
  this.createAnnotation = function(state, el, start, end) {
    var type = util.dom.getNodeType(el);

    var annotation = {
      path: _.last(state.stack).path,
      range: [start, end]
    };

    var annoType = _annotationTypes[type];
    if (type === "ext-link") {
      annotation.url = el.getAttribute("xlink:href");
    }

    annotation.id = state.nextId(annoType);
    annotation.type = annoType;
    state.annotations.push(annotation);
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
