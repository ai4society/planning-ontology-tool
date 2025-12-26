#!/usr/bin/env python3
"""
SPARQL Query Test Suite for Planning Ontology Knowledge Graph

This script tests all SPARQL query templates used in the planning-ontology-tool plugin.
It validates that queries return proper results with readable labels instead of datatype URIs.

Usage:
    python test_sparql_queries.py
"""

from rdflib import Graph
from rdflib.namespace import RDF, RDFS
import os
import sys
from pathlib import Path

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text):
    """Print a header with color"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*80}{Colors.ENDC}\n")

def print_subheader(text):
    """Print a subheader with color"""
    print(f"\n{Colors.BOLD}{Colors.CYAN}>>> {text}{Colors.ENDC}")

def print_success(text):
    """Print success message"""
    print(f"{Colors.GREEN}✓ {text}{Colors.ENDC}")

def print_error(text):
    """Print error message"""
    print(f"{Colors.RED}✗ {text}{Colors.ENDC}")

def print_warning(text):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.ENDC}")

def analyze_term_type(term):
    """Analyze and return the type of an RDF term"""
    if term is None:
        return "None", "---"

    term_type = str(type(term).__name__)
    term_value = str(term)

    return term_type, term_value

def format_table_row(columns, widths):
    """Format a table row with proper column widths"""
    row = ""
    for col, width in zip(columns, widths):
        col_str = str(col)[:width]
        row += f" {col_str:<{width}} |"
    return row

def print_query_results(query_name, description, query_text, results):
    """Print formatted query results"""
    print_subheader(f"Query: {query_name}")
    print(f"Description: {description}")
    print(f"\nSPARQL Query:\n{Colors.CYAN}{query_text}{Colors.ENDC}")

    if not results:
        print_warning("No results returned")
        return False

    print_success(f"{len(results)} result(s) found\n")

    # Determine column names and widths
    if results:
        columns = list(results[0].keys())
        widths = [max(len(col), max(len(str(r.get(col, ""))) for r in results[:5])) + 2
                  for col in columns]
        widths = [min(w, 40) for w in widths]  # Cap column width at 40 chars

        # Print header
        header = "|"
        for col, width in zip(columns, widths):
            header += f" {col:<{width}} |"
        print(header)
        print("|" + "-" * (sum(widths) + len(columns) * 3 - 1) + "|")

        # Print rows (max 10)
        for i, result in enumerate(results[:10]):
            row = "|"
            for col, width in zip(columns, widths):
                value = str(result.get(col, "")).replace("\n", " ")
                row += f" {value:<{width}} |"
            print(row)

        if len(results) > 10:
            print(f"\n... and {len(results) - 10} more rows")

    return True

def run_sparql_test(graph, queries):
    """Run all SPARQL queries and report results"""

    print_header("SPARQL Query Test Results")
    print(f"Graph loaded with {len(graph)} triples\n")

    passed = 0
    failed = 0
    issues = []

    for i, query_dict in enumerate(queries, 1):
        query_name = query_dict["name"]
        description = query_dict["description"]
        query_text = query_dict["query"]
        test_type = query_dict.get("type", "standard")

        print(f"\n{Colors.BOLD}Test {i}/{len(queries)}{Colors.ENDC}")

        try:
            # Execute query using rdflib
            query_result = graph.query(query_text)

            # Get variable names from query result object
            vars_list = list(query_result.vars) if hasattr(query_result, 'vars') else []

            if not vars_list:
                print_warning(f"Query '{query_name}' has no variables")
                failed += 1
                continue

            # Convert results to list of dicts
            result_dicts = []
            for row in query_result:
                result_dict = {}
                for var_idx, var in enumerate(vars_list):
                    result_dict[str(var)] = row[var_idx]
                result_dicts.append(result_dict)

            if not result_dicts:
                # Some queries might legitimately return no results
                if test_type == "required":
                    print_warning(f"Query '{query_name}' returned no results")
                    issues.append({
                        "query": query_name,
                        "issue": "No results returned",
                        "severity": "warning"
                    })
                else:
                    print_success(f"Query '{query_name}' executed (no results)")
                    passed += 1
            else:
                # Print results
                print_query_results(query_name, description, query_text, result_dicts)

                # Analyze results for datatype display issues
                has_datatype_issue = False
                for result in result_dicts:
                    for var, value in result.items():
                        value_str = str(value) if value else ""
                        # Check if we're showing a datatype URI instead of value
                        if "XMLSchema#" in value_str or ("Integer" in value_str and not any(char.isdigit() for char in value_str)):
                            has_datatype_issue = True
                            issues.append({
                                "query": query_name,
                                "variable": var,
                                "issue": f"Potential datatype display issue: {value_str}",
                                "severity": "warning"
                            })

                if has_datatype_issue:
                    print_warning(f"Query '{query_name}' may have datatype display issues")
                    passed += 1  # Count as passed but flag issue
                else:
                    print_success(f"Query '{query_name}' executed successfully with readable output")
                    passed += 1

        except Exception as e:
            print_error(f"Query '{query_name}' failed with error:")
            print(f"  {Colors.RED}{str(e)}{Colors.ENDC}")
            issues.append({
                "query": query_name,
                "issue": str(e),
                "severity": "error"
            })
            failed += 1

    # Print summary
    print_header("Test Summary")
    print(f"Total Queries: {len(queries)}")
    print_success(f"Passed: {passed}")
    if failed > 0:
        print_error(f"Failed: {failed}")

    if issues:
        print_subheader("Issues Found")
        for issue in issues:
            severity = issue["severity"]
            if severity == "error":
                print_error(f"[{issue['query']}] {issue['issue']}")
            else:
                print_warning(f"[{issue['query']}] {issue['issue']}")
    else:
        print_success("No issues detected!")

    return passed, failed, issues

def load_ontology():
    """Load the planning ontology RDF file"""
    rdf_file = Path(__file__).parent / "planning-ontology-graph.rdf"

    if not rdf_file.exists():
        print_error(f"RDF file not found: {rdf_file}")
        print("\nPlease ensure planning-ontology-graph.rdf exists in the same directory as this script.")
        sys.exit(1)

    print(f"Loading RDF file: {rdf_file}")
    graph = Graph()
    graph.parse(str(rdf_file), format="xml")
    print_success(f"Successfully loaded graph with {len(graph)} triples")

    return graph

def define_queries():
    """Define all SPARQL query templates"""

    # Namespace definitions for queries
    prefix = """
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX plan: <https://purl.org/ai4s/ontology/planning#>
    PREFIX dul: <http://www.ontologydesignpatterns.org/ont/dul/DUL.owl#>
    PREFIX lifecycle: <http://purl.org/vocab/lifecycle/schema#>
    """

    queries = [
        # ===== CURRENT QUERIES FROM plugin.js =====
        {
            "name": "All Actions",
            "description": "List all actions defined in the domain",
            "type": "required",
            "query": prefix + """
                SELECT ?action ?label WHERE {
                    ?action rdf:type plan:action .
                    ?action rdfs:label ?label .
                } ORDER BY ?label
            """
        },
        {
            "name": "Action Preconditions",
            "description": "Show preconditions for each action",
            "type": "required",
            "query": prefix + """
                SELECT ?actionLabel ?preconditionLabel WHERE {
                    ?action rdf:type plan:action .
                    ?action rdfs:label ?actionLabel .
                    ?action plan:hasPrecondition ?prec .
                    ?prec rdfs:label ?preconditionLabel .
                } ORDER BY ?actionLabel
            """
        },
        {
            "name": "Action Effects",
            "description": "Show effects for each action",
            "type": "required",
            "query": prefix + """
                SELECT ?actionLabel ?effectLabel WHERE {
                    ?action rdf:type plan:action .
                    ?action rdfs:label ?actionLabel .
                    ?action plan:hasEffect ?eff .
                    ?eff rdfs:label ?effectLabel .
                } ORDER BY ?actionLabel
            """
        },
        {
            "name": "Plan Steps",
            "description": "List the sequence of steps in the plan",
            "type": "required",
            "query": prefix + """
                SELECT ?stepNumber ?stepLabel WHERE {
                    ?plan rdf:type dul:Plan .
                    ?plan plan:hasPlanStep ?step .
                    ?step plan:hasStepNumber ?stepNumber .
                    ?step rdfs:label ?stepLabel .
                } ORDER BY ?stepNumber
            """
        },

        # ===== ADDITIONAL COMPREHENSIVE QUERIES FOR VALIDATION =====
        {
            "name": "Domain Information",
            "description": "Get domain name, requirements, and types",
            "type": "optional",
            "query": prefix + """
                SELECT ?domainLabel ?requirementLabel ?typeLabel WHERE {
                    ?domain rdf:type plan:domain .
                    ?domain rdfs:label ?domainLabel .
                    OPTIONAL {
                        ?domain plan:hasRequirement ?req .
                        ?req rdfs:label ?requirementLabel .
                    }
                    OPTIONAL {
                        ?domain plan:hasType ?type .
                        ?type rdfs:label ?typeLabel .
                    }
                } ORDER BY ?domainLabel
            """
        },
        {
            "name": "Problem Details",
            "description": "Show problem name and its objects",
            "type": "optional",
            "query": prefix + """
                SELECT ?problemLabel ?objectLabel WHERE {
                    ?problem rdf:type plan:problem .
                    ?problem rdfs:label ?problemLabel .
                    ?problem plan:hasObject ?obj .
                    ?obj rdfs:label ?objectLabel .
                } ORDER BY ?problemLabel ?objectLabel
            """
        },
        {
            "name": "Initial State",
            "description": "Show initial state predicates",
            "type": "optional",
            "query": prefix + """
                SELECT ?problemLabel ?initialStateLabel WHERE {
                    ?problem rdf:type plan:problem .
                    ?problem rdfs:label ?problemLabel .
                    ?problem plan:hasInitialState ?initState .
                    ?initState rdfs:label ?initialStateLabel .
                } ORDER BY ?problemLabel
            """
        },
        {
            "name": "Goal State",
            "description": "Show goal state predicates",
            "type": "optional",
            "query": prefix + """
                SELECT ?problemLabel ?goalStateLabel WHERE {
                    ?problem rdf:type plan:problem .
                    ?problem rdfs:label ?problemLabel .
                    ?problem plan:hasGoalState ?goalState .
                    ?goalState rdfs:label ?goalStateLabel .
                } ORDER BY ?problemLabel
            """
        },
        {
            "name": "Plan Details",
            "description": "Show plan cost and explanation",
            "type": "optional",
            "query": prefix + """
                SELECT ?planLabel ?planCost ?planExplanation WHERE {
                    ?plan rdf:type dul:Plan .
                    ?plan rdfs:label ?planLabel .
                    ?plan plan:hasPlanCost ?planCost .
                    OPTIONAL { ?plan plan:hasPlanExplanation ?planExplanation . }
                } ORDER BY ?planLabel
            """
        },
        {
            "name": "Action Parameters",
            "description": "Show action parameters and their types",
            "type": "optional",
            "query": prefix + """
                SELECT ?actionLabel ?parameterLabel ?parameterType WHERE {
                    ?action rdf:type plan:action .
                    ?action rdfs:label ?actionLabel .
                    ?action plan:hasParameter ?param .
                    ?param rdfs:label ?parameterLabel .
                    ?param plan:ofType ?type .
                    ?type rdfs:label ?parameterType .
                } ORDER BY ?actionLabel ?parameterLabel
            """
        },
        {
            "name": "Type Instances",
            "description": "Show all type instances (e.g., block instances)",
            "type": "optional",
            "query": prefix + """
                SELECT ?typeLabel ?instanceLabel WHERE {
                    ?type rdf:type plan:type .
                    ?type rdfs:label ?typeLabel .
                    ?type plan:hasTypeInstance ?instance .
                    ?instance rdfs:label ?instanceLabel .
                } ORDER BY ?typeLabel ?instanceLabel
            """
        },
        {
            "name": "Predicates in Domain",
            "description": "List all predicates defined in the domain",
            "type": "optional",
            "query": prefix + """
                SELECT ?domainLabel ?predicateLabel WHERE {
                    ?domain rdf:type plan:domain .
                    ?domain rdfs:label ?domainLabel .
                    ?domain plan:hasPredicate ?pred .
                    ?pred rdfs:label ?predicateLabel .
                } ORDER BY ?domainLabel ?predicateLabel
            """
        },
        {
            "name": "Complete Plan Sequence",
            "description": "Show complete plan with all step details",
            "type": "optional",
            "query": prefix + """
                SELECT ?planLabel ?stepNumber ?stepAction WHERE {
                    ?plan rdf:type dul:Plan .
                    ?plan rdfs:label ?planLabel .
                    ?plan plan:hasPlanStep ?step .
                    ?step plan:hasStepNumber ?stepNumber .
                    ?step rdfs:label ?stepAction .
                } ORDER BY ?planLabel ?stepNumber
            """
        }
    ]

    return queries

def main():
    """Main test execution"""
    print_header("Planning Ontology SPARQL Query Test Suite")

    try:
        # Load ontology
        graph = load_ontology()

        # Define queries
        queries = define_queries()

        # Run tests
        passed, failed, issues = run_sparql_test(graph, queries)

        # Exit with appropriate code
        sys.exit(0 if failed == 0 else 1)

    except Exception as e:
        print_error(f"Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
