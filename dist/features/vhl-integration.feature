Feature: VHL Integration – QR Code Validation Flow
  Validates a QR code, retrieves VHL content, and validates the FHIR Bundle.
  End-to-end test across ITI-YY3 (Generate VHL), ITI-YY4 (Provide VHL),
  and ITI-YY5 (Retrieve Manifest).

  Background:
    Given User is the system under test
    And HCertDecoder is available at "http://hcert-validator:8080"
    And VHLResponder is available at "http://hcert-validator:8080"
    And FHIRValidator is available at "http://fhir-server:8080/fhir"
    And SmartHelper is available at "http://smart-helper:8000"

  Scenario: tc-vhl-001 Full VHL verification pipeline
    When User uploads a QR image to HCertDecoder
    And extract "/qr_data" as "rawQRData"

    When User calls HCertDecoder at "/decode/hcert" with:
      """
      {"qr_data":"$rawQRData","include_raw":true}
      """
    And extract "/cose" as "coseVal"
    And extract "/payload" as "payloadVal"
    And extract "/hcert" as "hcertVal"
    And extract "/cose/_raw" as "coseRaw"

    When User calls HCertDecoder at "/extract/metadata" with cose and payload

    When User verifies COSE signature on HCertDecoder with:
      | parameter                  | value    |
      | use_gdhcn                  | true     |
      | gdhcn_env                  | dev      |
      | participant                | -        |
      | usage                      | DSC      |
      | verify_did_proof           | true     |
      | allow_unverified_trustlist | true     |
      | allow_remote_contexts      | true     |
      | context_dir                | contexts |
    And extract "/valid" as "sigValid"
    And "sigValid" should be "true"

    Given User enters a PIN

    When User calls HCertDecoder at "/extract/reference" with hcert and payload
    And extract "/url" as "shlinkUrl"

    When User authorizes SHL on VHLResponder with url and pin
    And extract "/manifest" as "manifestVal"

    When User fetches FHIR from VHLResponder with manifest
    And extract "/fhir/0/resource" as "firstResource"

    When User loads IG "https://lacpass.racsel.org" on SmartHelper
    When User validates "firstResource" against "http://lacpass.racsel.org/StructureDefinition/lac-bundle" on FHIRValidator

  Scenario: tc-vhl-002 Wrong PIN returns HTTP 422
    Given "shlinkUrl" is set
    When User authorizes SHL on VHLResponder with url and wrong pin "WRONGPIN"
    Then the response status should be "422"
