var schema = {

  // Views for storing order
  // ------------------

  "views": {
    // Stores order for content nodes
    "content": {},
    "figures": {},
    "publications": {},
    "info": {}
  },

  // Dynamic Indexes
  // ------------------

  "indexes": {

    // index comments by node associations
    "comments": {
      "type": "comment",
      "properties": ["source"]
    },

    // Annotations indexed by source
    "annotations": {
      "type": "annotation",
      "properties": ["source"]
    },

    // Only headings
    "headings": {
      "type": "heading",
      "properties": []
    },

    // Annotations indexed by target
    "reverse_annotations": {
      "type": "annotation",
      "properties": ["target"]
    },

    "figure_references": {
      "type": "figure_reference",
      "properties": ["source"]
    },

    "publication_references": {
      "type": "publication_reference",
      "properties": ["source"]
    },

    "reverse_publication_references": {
      "type": "publication_reference",
      "properties": ["target"]
    },

    "reverse_figure_references": {
      "type": "figure_reference",
      "properties": ["target"]
    }
  },

  "types": {

    // Shared by all content nodes (text, heading, formula)
    // ------------------

    "content": {
      "properties": {}
    },

    // Abstract type shared by all figure types (images, videos, tables, supplments)
    // ------------------

    "figure": {
      "properties": {
        "label": "string",
        "caption": "caption"
      }
    },

    // Formerly references
    // ------------------

    "publication": {
      "properties": {}
    },

    // Publication Info
    // ------------------

    "publication_info": {
      "properties": {

      }
    },

    // Citation
    // ------------------

    "citation": {
      "properties": {

      }
    },

    // Person (like authors and editors)
    // ------------------

    "person": {
      "properties": {
        "given-names": "string",
        "last-name": "string",
        "affiliations": "object",
        "image": "string",
        "emails": "object", // e.g. ["email:1", "email:2"]
        "contribution": "string",
      }
    },

    // Institution
    // ------------------

    "institution": {
      "properties": {
        "name": "string",
        "city": "string",
        "country": "string",
        "image": "string",
        "email": "string"
      }
    },

    // Funding
    // ------------------

    "funding": {
      "properties": {
      }
    },

    // Author
    // ------------------

    "author": {
      "properties": {
        "funding": "object", // e.g. ["funding:1", "funding:2"]
      }
    },

    // Editor
    // ------------------

    "editor": {
      "properties": {
      }
    },

    // Email (like authors and editors)
    // ------------------

    "email": {
      "properties": {
        "node": "node",
        "email": "string"
      }
    },

    // Datasets
    // ------------------

    "dataset": {
      "properties": {
        "authors": "object",
        "year": "string",
        "title": "string",
        "content": "string",
        "label": "string"
      }
    },

    // Cover Node (can be annotated)
    // ------------------

    "cover": {
      "parent": "content",
      "properties": {
        "title": "string",
        "abstract": "string",
        "authors": "object"
      }
    },

    // Heading Node (can be annotated)
    // ------------------

    "heading": {
      "parent": "content",
      "properties": {
        "content": "string"
      }
    },

    // Text Node (can be annotated)
    // ------------------

    "text": {
      "parent": "content",
      "properties": {
        "content": "string"
      }
    },

    // Image
    // ------------------

    "image": {
      "parent": "figure",
      "properties": {
        "large_url": "string",
        "medium_url": "string",
      }
    },

    // Supplement
    // ------------------

    "supplement": {
      "parent": "figure",
      "properties": {}
    },

    // Video
    // ------------------

    "video": {
      "parent": "figure",
      "properties": {
        "poster": "string",
        "url": "string",
        "url_ogv": "string",
      }
    },

    // HTML Table
    // ------------------

    "table": {
      "parent": "figure",
      "properties": {
        "content": "string",
      }
    },

    // Table Footer
    // ------------------

    "footer": {
      "properties": {
        "content": "string",
      }
    },

    // Formula (block)
    // ------------------

    "formula": {
      "parent": "content",
      "properties": {
        "label": "string",
        "content": "string"
      }
    },

    // Caption (used by figures, tables)
    // ------------------

    "caption": {
      "properties": {
        "title": "string",
        "content": "string",
        "source": "figure"
      }
    },

    // Abstract Annotation Type
    // ------------------

    "annotation": {
      "properties": {
        "source": "string", // should be type:node
        "key": "string",
        "pos": "object"
      }
    },

    // Text emphasis
    // ------------------

    "emphasis": {
      "parent": "annotation",
      "properties": {},
    },

    // Annotate text as strong
    // ------------------

    "strong": {
      "parent": "annotation",
      "properties": {},
    },

    // Inline code annotations
    // ------------------

    "code": {
      "parent": "annotation",
      "properties": {},
    },

    // Code block annotations
    // ------------------

    "codeblock": {
      "parent": "content",
      "properties": {
        "content": "string"
      },
    },

    // Annotate text as underlined
    // ------------------

    "underline": {
      "parent": "annotation",
      "properties": {},
    },

    // Subscript text
    // ------------------

    "subscript": {
      "parent": "annotation",
      "properties": {},
    },

    // Superscript text
    // ------------------

    "superscript": {
      "parent": "annotation",
      "properties": {},
    },

    // HTTP Link
    // ------------------

    "link": {
      "parent": "annotation",
      "properties": {
        "url": "string"
      }
    },

    // Inline Formula
    // ------------------

    "inline_formula": {
      "parent": "annotation",
      "properties": {
        "content": "string"
      }
    },

    // Formula Reference
    // ------------------

    "formula_reference": {
      "parent": "annotation",
      "properties": {
        "target": "figure",
      }
    },

    // Figure Reference (image, table, video)
    // ------------------

    "figure_reference": {
      "parent": "annotation",
      "properties": {
        "target": "figure",
      }
    },

    // Publication Reference
    // ------------------

    "publication_reference": {
      "parent": "annotation",
      "properties": {
        "target": "publication",
      }
    }
  }
};

module.exports = schema;