# GITB-Compatible REST API for the FHIR Validator HTTP Service

## Context

The FHIR Validator HTTP Service (https://github.com/hapifhir/org.hl7.fhir.core) currently exposes a set of REST endpoints (`/validateResource`, `/fhirpath`, `/matchetype`, `/testdata`, `/loadIG`, etc.). These work well for direct HTTP calls, but integrating with the GITB Test Bed (ITB) is problematic because:

1. **Handler registration**: ITB's `<process handler="X">` requires `X` to be a registered processing service. The current REST endpoints don't implement the GITB processing service contract.
2. **URL encoding**: The `/fhirpath` endpoint takes the expression as a query parameter, which breaks with complex FHIRPath expressions containing `(`, `)`, `'`, `%`, `$`, spaces, etc. Java's URI class in GITB's `HttpMessagingV2` double-encodes pre-encoded URLs.

## Goal

Add a parallel set of **GITB-compatible REST endpoints** under `/api/` that:
- Implement the GITB REST processing service contract (definition + process)
- Accept all parameters in the JSON request body (no query parameters)
- Wrap the existing validator engine logic (no duplication)
- Leave existing endpoints (`/validateResource`, `/fhirpath`, etc.) untouched

## GITB REST Processing Service Contract

Each processing service exposes two endpoints:

### `GET /api/{service}/definition`

Returns the service definition: what operations it supports, what inputs it expects, what outputs it produces. ITB calls this at **deploy time** to validate the TDL.

**Response** (`200 OK`, `application/json`):
```json
{
  "id": "ServiceName",
  "operations": ["op1", "op2"],
  "inputs": [
    { "name": "inputName", "type": "string", "required": true },
    { "name": "optionalInput", "type": "string", "required": false }
  ],
  "outputs": [
    { "name": "outputName", "type": "string" }
  ]
}
```

### `POST /api/{service}/process`

Executes an operation. ITB calls this at **execution time** for each `<process>` step.

**Request** (`application/json`):
```json
{
  "operation": "operationName",
  "inputs": {
    "inputName": "value",
    "anotherInput": "value"
  }
}
```

**Response** (`200 OK`, `application/json`):
```json
{
  "result": "SUCCESS",
  "output": {
    "outputName": "value"
  }
}
```

On error:
```json
{
  "result": "FAILURE",
  "error": "Human-readable error message"
}
```

---

## Service Definitions

### 1. FHIRPathProcessor — `/api/fhirpath`

Evaluates FHIRPath expressions against FHIR resources.

**Definition** (`GET /api/fhirpath/definition`):
```json
{
  "id": "FHIRPathProcessor",
  "operations": ["evaluate"],
  "inputs": [
    { "name": "resource", "type": "string", "required": true, "description": "FHIR resource as JSON string" },
    { "name": "expression", "type": "string", "required": true, "description": "FHIRPath expression to evaluate" }
  ],
  "outputs": [
    { "name": "result", "type": "string", "description": "Evaluation result as string (e.g. 'true', 'Smith', '3')" }
  ]
}
```

**Process** (`POST /api/fhirpath/process`):

Request:
```json
{
  "operation": "evaluate",
  "inputs": {
    "resource": "{\"resourceType\":\"Patient\",\"name\":[{\"family\":\"Smith\"}]}",
    "expression": "Patient.name.family"
  }
}
```

Response:
```json
{
  "result": "SUCCESS",
  "output": {
    "result": "Smith"
  }
}
```

**Implementation**: Parse `inputs.resource` as FHIR JSON, evaluate `inputs.expression` using the existing FHIRPath engine, return the first result as a string. This is the same logic as `POST /fhirpath?expression=...` but with the expression in the body instead of the query string.

---

### 2. FHIRValidator — `/api/validator`

Validates FHIR resources against profiles and IGs.

**Definition** (`GET /api/validator/definition`):
```json
{
  "id": "FHIRValidator",
  "operations": ["validate", "loadIG"],
  "inputs": [
    { "name": "resource", "type": "string", "required": false, "description": "FHIR resource as JSON string (required for 'validate')" },
    { "name": "profiles", "type": "string", "required": false, "description": "Comma-separated profile canonical URLs (for 'validate')" },
    { "name": "ig", "type": "string", "required": false, "description": "IG package reference, e.g. hl7.fhir.us.core#5.0.1 (for 'loadIG')" },
    { "name": "bpWarnings", "type": "string", "required": false, "description": "Best practice warning level: Ignore|Hint|Warning|Error (for 'validate')" },
    { "name": "resourceIdRule", "type": "string", "required": false, "description": "Resource ID rule: OPTIONAL|REQUIRED|PROHIBITED (for 'validate')" }
  ],
  "outputs": [
    { "name": "outcome", "type": "string", "description": "OperationOutcome JSON" },
    { "name": "severity", "type": "string", "description": "Highest severity: information|warning|error|fatal" },
    { "name": "errors", "type": "string", "description": "Number of error-level issues" },
    { "name": "warnings", "type": "string", "description": "Number of warning-level issues" }
  ]
}
```

**Process — validate** (`POST /api/validator/process`):

Request:
```json
{
  "operation": "validate",
  "inputs": {
    "resource": "{\"resourceType\":\"Patient\",\"name\":[{\"family\":\"Smith\"}]}",
    "profiles": "https://www.ehealth.fgov.be/standards/fhir/core/StructureDefinition/be-patient",
    "bpWarnings": "Warning"
  }
}
```

Response:
```json
{
  "result": "SUCCESS",
  "output": {
    "outcome": "{\"resourceType\":\"OperationOutcome\",\"issue\":[...]}",
    "severity": "information",
    "errors": "0",
    "warnings": "0"
  }
}
```

Note: `result` is `SUCCESS` even when there are validation errors — the operation itself succeeded. The test step uses `output.errors` or `output.severity` to decide pass/fail.

**Process — loadIG** (`POST /api/validator/process`):

Request:
```json
{
  "operation": "loadIG",
  "inputs": {
    "ig": "hl7.fhir.be.vaccination#1.1.2"
  }
}
```

Response:
```json
{
  "result": "SUCCESS",
  "output": {
    "outcome": "{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"information\",\"code\":\"informational\",\"details\":{\"text\":\"IG loaded successfully: hl7.fhir.be.vaccination#1.1.2\"}}]}",
    "severity": "information"
  }
}
```

On failure (IG not found, network error):
```json
{
  "result": "FAILURE",
  "error": "Failed to load IG: Package not found: hl7.fhir.be.vaccination#9.9.9"
}
```

**Implementation**: `validate` calls the same logic as `POST /validateResource`, then parses the OperationOutcome to extract severity counts. `loadIG` calls the same logic as `POST /loadIG`.

---

### 3. MatchetypeProcessor — `/api/matchetype`

Compares FHIR resources against expected patterns with wildcards.

**Definition** (`GET /api/matchetype/definition`):
```json
{
  "id": "MatchetypeProcessor",
  "operations": ["compare"],
  "inputs": [
    { "name": "resource", "type": "string", "required": true, "description": "Actual FHIR resource as JSON string" },
    { "name": "matchetype", "type": "string", "required": true, "description": "Expected pattern as JSON string (may contain wildcards like $string$, $date$)" },
    { "name": "mode", "type": "string", "required": false, "description": "'complete' (default) or 'partial'" }
  ],
  "outputs": [
    { "name": "outcome", "type": "string", "description": "OperationOutcome JSON with comparison results" },
    { "name": "severity", "type": "string", "description": "Highest severity: 'information' means match, 'error' means mismatch" }
  ]
}
```

**Process** (`POST /api/matchetype/process`):

Request:
```json
{
  "operation": "compare",
  "inputs": {
    "resource": "{\"resourceType\":\"Patient\",\"name\":[{\"family\":\"Doe\"}]}",
    "matchetype": "{\"resourceType\":\"Patient\",\"name\":[{\"family\":\"$string$\"}]}",
    "mode": "partial"
  }
}
```

Response:
```json
{
  "result": "SUCCESS",
  "output": {
    "outcome": "{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"information\",\"code\":\"informational\",\"details\":{\"text\":\"All OK\"}}]}",
    "severity": "information"
  }
}
```

**Implementation**: Wraps the existing `POST /matchetype` logic.

---

### 4. TestDataGenerator — `/api/testdata`

Generates conformant test data from FHIR profiles.

**Definition** (`GET /api/testdata/definition`):
```json
{
  "id": "TestDataGenerator",
  "operations": ["generate", "generateBundle"],
  "inputs": [
    { "name": "profile", "type": "string", "required": true, "description": "Canonical URL of the FHIR profile" },
    { "name": "mappings", "type": "string", "required": false, "description": "JSON array of path-to-expression mappings" },
    { "name": "data", "type": "string", "required": false, "description": "JSON array of data rows" },
    { "name": "bundle", "type": "string", "required": false, "description": "Set to 'true' to return a Bundle" }
  ],
  "outputs": [
    { "name": "resource", "type": "string", "description": "Generated FHIR resource or Bundle as JSON string" }
  ]
}
```

**Process — generate** (`POST /api/testdata/process`):

Request:
```json
{
  "operation": "generate",
  "inputs": {
    "profile": "http://hl7.org/fhir/StructureDefinition/Patient"
  }
}
```

Response:
```json
{
  "result": "SUCCESS",
  "output": {
    "resource": "{\"resourceType\":\"Patient\",\"name\":[{\"family\":\"Generated\",\"given\":[\"Test\"]}]}"
  }
}
```

**Implementation**: Wraps the existing `POST /testdata` logic.

---

### 5. ValidationResultsProcessor — `/api/validation-results`

Post-processes an OperationOutcome to extract summary counts and filter by severity/text. This is a utility service that works on already-produced OperationOutcomes.

**Definition** (`GET /api/validation-results/definition`):
```json
{
  "id": "ValidationResultsProcessor",
  "operations": ["summarize", "filterBySeverity", "filterByText"],
  "inputs": [
    { "name": "outcome", "type": "string", "required": true, "description": "OperationOutcome JSON string" },
    { "name": "severity", "type": "string", "required": false, "description": "Severity to filter by (for 'filterBySeverity')" },
    { "name": "text", "type": "string", "required": false, "description": "Text to search for in issue details (for 'filterByText')" }
  ],
  "outputs": [
    { "name": "errors", "type": "string", "description": "Number of error-level issues" },
    { "name": "warnings", "type": "string", "description": "Number of warning-level issues" },
    { "name": "count", "type": "string", "description": "Number of matching issues (for filter operations)" }
  ]
}
```

**Process — summarize** (`POST /api/validation-results/process`):

Request:
```json
{
  "operation": "summarize",
  "inputs": {
    "outcome": "{\"resourceType\":\"OperationOutcome\",\"issue\":[{\"severity\":\"error\",\"code\":\"invalid\",\"details\":{\"text\":\"Missing required element\"}}]}"
  }
}
```

Response:
```json
{
  "result": "SUCCESS",
  "output": {
    "errors": "1",
    "warnings": "0"
  }
}
```

**Implementation**: Pure JSON parsing — count issues by severity. No FHIR engine needed.

---

## Endpoint Summary

| Service | Definition | Process | Wraps |
|---------|-----------|---------|-------|
| FHIRPathProcessor | `GET /api/fhirpath/definition` | `POST /api/fhirpath/process` | `/fhirpath` |
| FHIRValidator | `GET /api/validator/definition` | `POST /api/validator/process` | `/validateResource`, `/loadIG` |
| MatchetypeProcessor | `GET /api/matchetype/definition` | `POST /api/matchetype/process` | `/matchetype` |
| TestDataGenerator | `GET /api/testdata/definition` | `POST /api/testdata/process` | `/testdata` |
| ValidationResultsProcessor | `GET /api/validation-results/definition` | `POST /api/validation-results/process` | (pure JSON) |

## How ITB Uses This

**In the TDL test case:**
```xml
<imports>
  <module name="FHIRPathProcessor" uri="http://fhir-validator:8080/api/fhirpath"/>
  <module name="FHIRValidator" uri="http://fhir-validator:8080/api/validator"/>
</imports>
```

ITB calls `GET {uri}/definition` at deploy time, `POST {uri}/process` at execution time.

**Example TDL step:**
```xml
<process handler="FHIRPathProcessor" operation="evaluate" output="fhirpathResult">
  <input name="resource">$immunizationResource</input>
  <input name="expression">"performer.exists() implies ..."</input>
</process>
```

ITB sends:
```
POST http://fhir-validator:8080/api/fhirpath/process
Content-Type: application/json

{
  "operation": "evaluate",
  "inputs": {
    "resource": "<value of $immunizationResource>",
    "expression": "performer.exists() implies ..."
  }
}
```

No URL encoding. No HttpMessagingV2 workarounds. Expression can be arbitrarily complex.

## Implementation Notes

- Each `/api/{service}` endpoint is a thin wrapper — parse GITB JSON inputs, call existing engine methods, wrap results in GITB JSON response.
- Existing endpoints remain unchanged for backwards compatibility and direct use.
- The `ValidationResultsProcessor` doesn't need the FHIR engine at all — it's pure OperationOutcome JSON parsing.
- All input/output values are strings (GITB convention). JSON objects are passed as stringified JSON.
- Error handling: catch exceptions from the engine, return `{"result": "FAILURE", "error": "..."}`.
