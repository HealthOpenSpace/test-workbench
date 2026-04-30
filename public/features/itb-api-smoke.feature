Feature: FHIR Validator ITB REST API smoke test
  Exercises the GITB-aligned endpoints under /itb/* end to end:
    - igManager: load an IG
    - testdata: generate resources (required elements only)
    - fhir: validate against base spec and against an IG profile
    - fhirpath: evaluate (extract a value)
    - fhirpath: assert (expression must be true)

  Background:
    Given Client is the system under test
    And FHIRValidator is available at "http://fhir-validator:8081"

  Scenario: itb-smoke-001 Generate, validate, load IG, validate against IG, FHIRPath extract and assert

    # ------------------------------------------------------------------
    # Step 1: Load the Belgian Allergy IG (pulls in be.core as a dependency)
    # ------------------------------------------------------------------
    Given FHIRValidator is loaded with package "hl7.fhir.be.allergy#1.2.0"

    # ------------------------------------------------------------------
    # Step 2: Generate resources with required elements only
    # ------------------------------------------------------------------
    Given generate required test data as "patient" from profile "http://hl7.org/fhir/StructureDefinition/Patient" with values:
      | path       | value          |
      | Patient.id | smoke-test-001 |
    Given generate required test data as "allergy" from profile "https://www.ehealth.fgov.be/standards/fhir/allergy/StructureDefinition/be-allergyintolerance" with values:
      | path                                     | system                                                            | code    |
      | AllergyIntolerance.code.coding           | http://snomed.info/sct                                            | 1232123 |
      | AllergyIntolerance.clinicalStatus.coding | http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical | active  |

    # ------------------------------------------------------------------
    # Step 3: Validate Patient against base spec, allergy against Belgian profile
    # ------------------------------------------------------------------
    Then "patient" should be a valid Patient resource
    And validate "allergy" against "https://www.ehealth.fgov.be/standards/fhir/allergy/StructureDefinition/be-allergyintolerance"
    And the validation should pass

    # ------------------------------------------------------------------
    # Step 4: Extract a value with FHIRPath (evaluate)
    # ------------------------------------------------------------------
    And evaluate FHIRPath "Patient.id" on "patient" as "patientId"

    # ------------------------------------------------------------------
    # Step 5: Assert a FHIRPath expression (evaluate-and-expect)
    # ------------------------------------------------------------------
    And evaluate FHIRPath "Patient.id.exists()" on "patient" and expect "true"
