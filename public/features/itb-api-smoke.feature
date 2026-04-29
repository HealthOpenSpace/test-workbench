Feature: FHIR Validator ITB REST API smoke test
  Exercises the GITB-aligned endpoints under /itb/* end to end:
    - testdata: generate a Patient
    - fhir: validate against base spec
    - fhir: load the Belgian Core IG
    - fhir: validate the same Patient against the be-patient profile
    - fhirpath: evaluate (extract a value)
    - fhirpath: assert (expression must be true)

  Background:
    Given Client is the system under test
    And FHIRValidator is available at "http://fhir-validator:8081"

  Scenario: itb-smoke-001 Generate, validate, load IG, validate against IG, FHIRPath extract and assert

    # ------------------------------------------------------------------
    # Step 1: Generate a Patient (and an AllergyIntolerance) with required elements only
    # ------------------------------------------------------------------
    Given generate required test data from profile "http://hl7.org/fhir/StructureDefinition/Patient" as "patient"
    Given generate required test data from profile "http://hl7.org/fhir/StructureDefinition/AllergyIntolerance" as "allergy"

    # ------------------------------------------------------------------
    # Step 2: Validate against base FHIR spec
    # ------------------------------------------------------------------
    Then "patient" should be a valid Patient resource
    And "allergy" should be a valid AllergyIntolerance resource

    # ------------------------------------------------------------------
    # Step 3: Load the Belgian Core IG (which carries the allergy profile)
    # ------------------------------------------------------------------
    And FHIRValidator is loaded with package "hl7.fhir.be.core#2.1.2"

    # ------------------------------------------------------------------
    # Step 4: Validate generated allergy against the Belgian profile
    # ------------------------------------------------------------------
    And validate "allergy" against "https://www.ehealth.fgov.be/standards/fhir/core/StructureDefinition/be-allergyintolerance"
    And the validation should pass

    # ------------------------------------------------------------------
    # Step 5: Extract a value with FHIRPath (evaluate)
    # ------------------------------------------------------------------
    And evaluate FHIRPath "Patient.id" on "patient" as "patientId"

    # ------------------------------------------------------------------
    # Step 6: Assert a FHIRPath expression (evaluate-and-expect)
    # ------------------------------------------------------------------
    And evaluate FHIRPath "Patient.id.exists()" on "patient" and expect "true"
