# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a plugin for the [Planning.Domains](https://editor.planning.domains) online PDDL editor. It converts PDDL (Planning Domain Definition Language) domain and problem files into RDF/OWL knowledge graphs, visualizes them using D3.js, and enables SPARQL querying.

## Architecture

The plugin consists of two main files that work together:

**plugin.js** - Browser-side JavaScript plugin
- Runs inside the Planning.Domains editor environment (AMD module using `define()`)
- Loads external libraries: D3.js, rdflib.js, N3.js, Comunica (SPARQL engine), and Pyodide
- Uses Pyodide to execute Python code directly in the browser
- Fetches the Python module from a Gist URL at runtime (`PY_MODULE_URL` constant)
- Creates a new tab in the editor with the knowledge graph visualization and SPARQL panel

**ontology.py** - Python ontology generator (runs in Pyodide)
- `PDDLParser` class: Parses PDDL domain/problem files into structured dictionaries
- `OntologyBuilder` class: Converts parsed data into RDF triples using rdflib
- `DomainFunctions` / `ProblemFunctions`: Helper classes for parsing specific PDDL sections
- `create_ontology()`: Main entry point called from JavaScript
- Uses the AI4S Planning Ontology namespace (`https://purl.org/ai4s/ontology/planning#`)

**Data Flow:**
1. User selects domain/problem PDDL files in the editor
2. JavaScript calls `createOntologyWithPython()` which invokes the Python `create_ontology()` function via Pyodide
3. Python parses PDDL and generates RDF/XML ontology string
4. JavaScript parses the RDF/XML with rdflib.js, builds graph data, and renders with D3
5. SPARQL queries run via Comunica against an N3 store built from the rdflib statements

## Development and Testing

**Option 1: Using Surge (persistent URL)**
```bash
npm install -g surge
mkdir plugin-folder && cp plugin.js plugin-folder/
surge plugin-folder  # Creates a URL like https://yourname.surge.sh
```

**Option 2: Using GitHub Gist**
1. Create a Gist with `plugin.js`
2. Get the Raw URL and replace `gist.githubusercontent.com` with `gistcdn.githack.com`
3. Note: Raw URL changes with each update

**Testing the plugin:**
Load the editor with your plugin: `https://editor.planning.domains/#<your-plugin-url>`

## Key Constants and Configuration

In `plugin.js`:
- `PY_MODULE_URL`: URL to the hosted `ontology.py` file (currently a Gist)
- `PY_MODULE_NAME` / `PY_FUNC_NAME`: Python module and function names
- `D3_STYLE`: Visual styling for graph nodes by type (domain, problem, action, etc.)
- `RDF_IGNORE_PREDICATES`: Predicates filtered out from graph visualization
- `PLUGIN_LIBS`: CDN URLs for all external dependencies

## PDDL Parsing Details

The parser handles standard PDDL constructs:
- Domain: requirements, types (with hierarchy), constants, predicates, actions (with parameters, preconditions, effects)
- Problem: objects (typed/untyped), initial state, goal state

The `find_parens()` function is critical for parsing nested PDDL structures by matching parentheses.
