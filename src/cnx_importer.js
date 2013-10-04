"use strict";

var _ = require("underscore");
var util = require("substance-util");
var ImporterError = require("./converter_errors").ImporterError;

var CNXImporter = function() {
};

CNXImporter.Prototype = function() {

  this.createDocument = function() {
    var Article = require("substance-article");
    var doc = new Article();

    return doc;
  };

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
    var state = new CNXImporter.State(xmlDoc, doc);

    this.document(state, xmlDoc);

    this.postProcessing(state);

    return state.doc;
  };

  this.document = function(state, xmlDoc) {
    var doc = state.doc;

    var title = xmlDoc.querySelector("title");
    if (title) {
      doc.title = title.textContent;
    }

    var metaData = xmlDoc.querySelector("metadata");
    if (metaData) {
      this.metaData(state, metaData);
    }

    var content = xmlDoc.querySelector("content");
    if (content) {
      this.content(state, content);
    }
  };

  this.postProcessing = function(state) {
    var doc = state.doc;

    var i;

    // Creating the annotations afterwards, to make sure
    // that all referenced nodes are available
    for (i = 0; i < state.annotations.length; i++) {
      doc.create(state.annotations[i]);
    }

    // Rebuild views to ensure consistency
    _.each(doc.views, function(view) {
      doc.get(view).rebuild();
    });
  };

  this.metaData = function(state, input) {

    var actors = input.querySelector("actors");
    var roles = input.querySelector("roles");
    this.collaborators(state, actors, roles);

    // var keywordList = input.querySelector("md\\:keywordlist");
  };

  this.collaborators = function(state, roles, actors) {
    var doc = state.doc;

    var actorRoles = {};
    _.each(util.dom.getChildren(roles), function(el) {
      var roleType = el.getAttribute("type");
      var actorId = el.textContent;
      var _roles = actorRoles[actorId];
      if (!_roles) {
        _roles = [];
        actorRoles[actorId] = _roles;
      }
      _roles.push(roleType);
    });

    _.each(util.dom.getChildren(actors), function(el) {
      // we do not consider the different types yet
      // var type = util.dom.getNodeType(el);

      var userId = el.getAttribute("userid");

      // HACK: currently a Substance.Collaborator has a single role
      // and an extra field describing the extend of the contribution
      // If we find the actor being an actor we use this as main role
      // otherwise we take the first given role
      var role;
      var contribution;
      var _roles = actorRoles[userId];
      if (_roles === undefined) {
        role = "unknown";
      } else if (_roles.indexOf("author") > 0) {
        role = "author";
        contribution = _roles.join(", ");
      } else {
        role = _roles[0];
        contribution = _roles.join(", ");
      }

      var name;
      var nameEl = el.querySelector("name");
      if (nameEl) name = nameEl.textContent;

      var id = state.nextId("collaborator");
      var collaborator = {
        id: id,
        type: "collaborator",
        source_id: userId,
        name: name,
        role: role,
        contribution: contribution
      };

      doc.create(collaborator);
      state.collaborators.push(collaborator);
    });
  };

  this.content = function(state, input) {
    var doc = state.doc;

    var children = util.dom.getChildren(input);

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = util.dom.getNodeType(child);

      var nodes;
      switch (type) {
      case "section":
        nodes = this.section(state, child);
        break;
      default:
        console.error("Not yet supported:", type);
      }

      if (nodes) {
        if (!_.isArray(nodes)) {
          nodes = [nodes];
        }
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          doc.show("content", node.id);
        }
      }
    }
  };

  this.section = function(state, input) {
    var nodes = [];
    var doc = state.doc;

    state.sectionLevel++;

    var source_id = input.getAttribute("id");
    var title = input.querySelector("title");
    var heading = {
      id: state.nextId("heading"),
      type: "heading",
      source_id: source_id,
      content: title.textContent
    };
    doc.create(heading);
    nodes.push(heading);

    var children = util.dom.getChildren(input);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = util.dom.getNodeType(child);

      var node;
      switch(type) {
      case "title":
        continue;
      case "para":
        node = this.paragraph(state, child);
        if (node) nodes.push(node);
        break;
      case "section":
        var _nodes = this.section(state, child);
        if (_nodes) nodes = nodes.concat(_nodes);
        break;
      case "figure":
        console.error("'figure' not implemented yet.");
        break;
      case "list":
        node = this.list(state, child);
        if (node) nodes.push(node);
        break;
      case "definition":
        node = this.definition(state, child);
        if (node) nodes.push(node);
        break;
      default:
        console.error("Not yet supported: " + type);
      }
    }
    state.sectionLevel--;
    return nodes;
  };

  this.paragraph = function(state, input) {
    var iterator = new util.dom.ChildNodeIterator(input);

    var nodes = [];

    var node;
    while(iterator.hasNext()) {
      node = this.paragraphElem(state, iterator);
      if (node) nodes.push(node);
    }

    if (nodes.length === 0) {
      return null;
    }

    if (nodes.length === 1) {
      return nodes[0];
    }

    var doc = state.doc;
    var id = state.nextId("paragraph");
    node = {
      id: id,
      type: "paragraph",
      children: _.map(nodes, function(n) { return n.id; })
    };
    doc.create(node);

    return node;
  };

  this.list = function(state, input) {
    var doc = state.doc;
    var ordered = (input.getAttribute("list-type") === "enumerated");
    var id = state.nextId("list");
    var source_id = input.getAttribute("id");
    var listNode = {
      id: id,
      source_id: source_id,
      type: "list",
      items: [],
      ordered: ordered
    };

    var items = input.querySelectorAll("item");

    // TODO: this is not tackled appropriately
    // we should use
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var node = this.paragraph(state, item);
      if (node) {
        listNode.items.push(node.id);
      }
    }

    doc.create(listNode);
    return listNode;
  };

  this.paragraphElem = function(state, iterator) {
    var doc = state.doc;
    var input = iterator.next();
    var type = util.dom.getNodeType(input);

    var node, id;

    switch (type) {
    case "text":
    case "emphasis":
    case "sub":
    case "link":
      id = state.nextId("text");
      node = {
        id: id,
        type: "text",
        content: ""
      };
      state.push(node);
      // set the iterator back by one
      iterator.back();
      node.content = this.annotatedText(state, iterator, 0);
      state.pop();
      doc.create(node);
      break;
    case "list":
      node = this.list(state, input);
      break;
    case "para":
      node = this.paragraph(state, input);
      break;
    default:
      console.error("Not yet supported: ", type, "Skipping.");
    }

    return node;
  };

  this.definition = function(state, input) {
    var doc = state.doc;

    var termEl = input.querySelector("term");
    var termNode = {
      id: state.nextId("term"),
      source_id: termEl.getAttribute("id"),
      type: "text",
      content: termEl.textContent
    };
    doc.create(termNode);

    var meaningEl = input.querySelector("meaning");
    var meaningParaEl = meaningEl.querySelector("para");
    var meaningNode = this.paragraph(state, meaningParaEl);

    var id = state.nextId("definition");
    var definitionNode = {
      id: id,
      type: "paragraph",
      children: [termNode.id, meaningNode.id]
    };
    doc.create(definitionNode);
    state.definitions.push(definitionNode);

    return definitionNode;
  };

  this.annotatedText = function(state, iterator, startPos) {
    var result = [];
    var pos = startPos || 0;

    var str;
    while(iterator.hasNext()) {
      var el = iterator.next();
      var type = util.dom.getNodeType(el);

      switch (type) {
      case "text":
        str = el.textContent;
        result.push(str);
        pos += str.length;
        break;
      case "emphasis":
      case "sub":
      case "link":
        str = this.annotation(state, el, pos);
        result.push(str);
        pos += str.length;
        break;
      default:
        iterator.back();
        return result.join("");
      }
    }
    return result.join("");
  };

  this.annotation = function(state, input, startPos) {
    var targetNode = state.current();
    if (targetNode === undefined) {
      throw new ImporterError("No target for annotation available");
    }
    var type = util.dom.getNodeType(input);
    var annotationType;

    var data = {};

    switch(type) {
    case "emphasis":
      var emphType = input.getAttribute("effect");
      if (emphType === "bold") {
        annotationType = "strong";
      } else if (emphType === "italics") {
        annotationType = "emphasis";
      }
      break;
    case "sub":
      annotationType = "subscript";
      break;
    case "link":
      annotationType = "link";
      data.url = input.getAttribute("resource");
      break;
    default:
      throw new ImporterError("Annotation not supported: " + type);
    }

    var iterator = new util.dom.ChildNodeIterator(input);
    var content = this.annotatedText(state, iterator, startPos);

    if (content.length > 0) {
      var endPos = startPos + content.length;

      var id = state.nextId(annotationType);
      var annotation = {
        id: id,
        type: annotationType,
        path: [targetNode.id, "content"],
        range: [startPos, endPos]
      };

      _.extend(annotation, data);

      state.annotations.push(annotation);
    }

    return content;
  };

  // Note: CNX figure nodes are mapped to the corresponding concrete type
  this.figure = function(/*state, input*/) {
    //var node = {};
    //return doc.create(node);
    return null;
  };

};

CNXImporter.prototype = new CNXImporter.Prototype();

CNXImporter.State = function(xmlDoc, doc) {
  // the input xml document
  this.xmlDoc = xmlDoc;

  // the output substance document
  this.doc = doc;

  this.collaborators = [];

  this.definitions = [];

  // store annotations to be created here
  // they will be added to the document when everything else is in place
  this.annotations = [];

  this.sectionLevel = 0;

  // when recursing into sub-nodes it is necessary to keep the stack
  // of processed nodes to be able to associate other things (e.g., annotations) correctly.
  this.stack = [];
  this.current = function() {
    return this.stack[this.stack.length-1];
  };
  this.push = function(node) {
    this.stack.push(node);
  };
  this.pop = function() {
    return this.stack.pop();
  };

  // an id generator for different types
  var ids = {};
  this.nextId = function(type) {
    ids[type] = ids[type] || 0;
    ids[type]++;
    return type +"_"+ids[type];
  };
};


module.exports = CNXImporter;
