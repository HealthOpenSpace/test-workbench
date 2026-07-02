Feature: HCERT PH4H — QR to MEOW MedicationOverview Bundle
  Semantic-equivalent of the hcert-icvp pipeline retargeted to PH4H /
  IHE Pharm MEOW: same QR upload → decode → COSE-verify flow, but the
  inner CWT payload (compact PH4H MedicationOverviewMin at /-260/-6)
  is transformed via the smart-ph4h StructureMap into a MEOW
  MedicationOverview Bundle and validated against the IHE Pharm MEOW
  Bundle profile through SMART Helper.

  Background:
    Given User is the system under test
    And HCertDecoder is infrastructure at "http://hcert-validator:8080"
    # GITB-compatible FHIR validator (validator_cli.jar) — exposes
    # /itb/{igManager,transform,loadResource,fhir}/process. Handles IG load,
    # StructureMap transform, and profile validation natively so no
    # SmartHelper / Matchbox pair is needed.
    And FHIRValidator is infrastructure at "http://fhir-validator:8080"

  Scenario: tc-ph4h-qr-001 QR → decode → transform → MEOW conformance

    # ------------------------------------------------------------------
    # 1) Upload QR image and pull the raw HC1 payload.
    # ------------------------------------------------------------------
    When User uploads a QR image to HCertDecoder
    And extract "/qr_data" as "rawQRData"

    # ------------------------------------------------------------------
    # 2) Decode HC1 → captures $coseVal, $payloadVal, $hcertVal, $coseRaw.
    # ------------------------------------------------------------------
    When User decodes HC1 on HCertDecoder

    # ------------------------------------------------------------------
    # 3) Extract inner CWT payload content. The PH4H MedicationOverviewMin
    #    lives at CWT claim -260 / -6 (HCERT container claim).
    # ------------------------------------------------------------------
    And extract "/-260/-6" from "payloadVal" as "innerContent"

    # ------------------------------------------------------------------
    # 4) Verify COSE signature against GDHCN **DEV** trustlist. PH4H
    #    signer keys live in the dev network; UAT would fail with
    #    "no matching KID in trustlist".
    # ------------------------------------------------------------------
    When User verifies COSE signature on HCertDecoder with:
      | parameter                  | value    |
      | use_gdhcn                  | true     |
      | gdhcn_env                  | dev      |
      | domain                     | PH4H     |
      | participant                | -        |
      | usage                      | DSC      |
      | verify_did_proof           | true     |
      | allow_unverified_trustlist | true     |
      | allow_remote_contexts      | true     |
      | context_dir                | contexts |
    Then "response status" should be "200"
    And extract "/valid" as "sigValid"
    And "sigValid" should be "true"

    # ------------------------------------------------------------------
    # 5) Load only the IGs the transform + validate need:
    #    - smart-ph4h: source LM + chained StructureMap
    #    - IHE Pharm MEOW: target Bundle profile
    #    smart-trust is NOT loaded here — that's the underlying trust
    #    framework used at signature-verify time, and it's already
    #    consumed by gdhcn-helper via the DID trustlist fetch. Loading
    #    it into the validator pulls in ~7k unrelated R4↔R5 conversion
    #    resources that this test doesn't need.
    # ------------------------------------------------------------------
    When User loads IG "https://worldhealthorganization.github.io/smart-ph4h/branches/MeOW-r4/package.tgz" on FHIRValidator
    Then "response status" should be "200"

    When User loads IG "https://ihe.github.io/pharm-meow/branches/r4/package.tgz" on FHIRValidator
    Then "response status" should be "200"

    # ------------------------------------------------------------------
    # 6) Transform inner CWT payload → MEOW MedicationOverview Bundle via
    #    the WHO smart-ph4h chained map (Min → LM → Bundle).
    #    NOTE: verify the map canonical against the fetched FML header —
    #    placeholder URL follows the smart.who.int/ph4h convention.
    # ------------------------------------------------------------------
    When User transforms "innerContent" on FHIRValidator with map "http://smart.who.int/ph4h/StructureMap/MedicationOverviewMin-to-MedicationOverviewBundle" as "bundleResult"
    Then "response status" should be "200"

    # ------------------------------------------------------------------
    # 7) Validate the resulting Bundle against the IHE Pharm MEOW
    #    MedicationOverview Bundle profile via the validator's
    #    /itb/fhir/validate endpoint.
    # ------------------------------------------------------------------
    Then "bundleResult" conforms to "https://profiles.ihe.net/ITI/pharm/MEOW/StructureDefinition/IHE.PHARM.MEOW.MedicationOverviewBundle"
