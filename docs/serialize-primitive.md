# The `serializeJsonObject` primitive

**Status:** implemented (2026-07). Ships as a scriptlet under `smart-helper`
so it's automatically available whenever the smart-helper component is
enabled. See `public/components/smart-helper/scriptlets/serializeJsonObject.xml`.

## The problem

Test-workbench steps repeatedly follow this pattern:

1. Extract a value from an HTTP response with `JsonPointerProcessor`.
2. Embed that value inside a new JSON body via Freemarker `${var}`.
3. `send` the body to the next service.

Step 2 quietly breaks whenever the extracted value is a **JSON object or
array** (not a scalar). The failure mode is deterministic:

- `JsonPointerProcessor` returns the pointed-to value. For objects it
  returns a Java `Map`; for arrays a Java `List`.
- The generator declares extract outputs as `type="string"` — so ITB
  coerces the returned Map/List to a string via `toString()`.
- Java's `Map.toString()` emits `{key=value, key2=value2}` (equals sign,
  no quotes). `List.toString()` emits `[a, b, c]`. Both look JSON-ish
  from ten feet away but are not RFC 8259.
- Freemarker's `${var}` on a non-scalar object also calls the same
  `toString` — so even if you skip the string-typed variable and pass
  the Map directly into the template, you still get the same broken
  output.
- Downstream service parses the body with Jackson / Python `json.loads`
  and rejects it at the first key that isn't wrapped in `"`. Test
  fails with `400 Bad Request` and a confusing `line 1 column 2` error.

Sites that hit this before the fix:

| File | Pattern |
|---|---|
| `public/components/hcert-decoder/steps.yml` — `verifies COSE signature` | `"cose_raw":${cose_raw}` |
| `public/components/hcert-decoder/scriptlets/verifyCoseSignature.xml` | same, standalone scriptlet |
| `public/lang/en.yml` — `transforms via ... with map ...` | `template: "'${obj}'"` |
| `public/lang/en.yml` — `validates via ... targeting ...` | `"resource":${resource}` |

Every generated test that used any of these steps to embed a
`JsonPointer`-extracted object silently produced malformed JSON. The
reference `hcert-icvp` test suite in `testsuites/` shipped with the same
bug, so this had never actually been exercised end-to-end through
`smart-helper` before.

## The primitive

A single scriptlet that walks any value and emits RFC 8259 JSON.

### Contract

```
Inputs:
  input   any                    — the value to serialize
Outputs:
  jsonString  string             — RFC 8259 JSON representation
```

### Implementation sketch

```freemarker
<#macro toJson v>
  <#if !v??>null<#return></#if>
  <#if v?is_boolean>${v?c}
  <#elseif v?is_number>${v?c}
  <#elseif v?is_string>"${v?json_string}"
  <#elseif v?is_hash>{<#list v?keys as k>"${k?json_string}":<@toJson v=v[k]/><#sep>,</#list>}
  <#elseif v?is_sequence>[<#list v as item><@toJson v=item/><#sep>,</#list>]
  <#else>"${v?string?json_string}"
  </#if>
</#macro>
<@toJson v=input/>
```

Delivered via `TemplateProcessor` because that's the one processor we
can rely on being present in every ITB deployment.

### ITB compatibility requirement

The primitive depends on **`TemplateProcessor` passing its `parameters`
map to Freemarker as a native hash** — i.e. Freemarker's type-introspection
built-ins (`?is_hash`, `?is_sequence`, `?keys`, indexed access) must see
the underlying Java Map / List, not a stringified form.

This holds in the GITB reference implementation from at least 1.19
onwards (the version this workbench targets). If a deployment
`toString`'s parameters before invoking Freemarker, the primitive returns
`Map.toString()` and the caller sees the same broken output as before.

Verify with a smoke test:

```xml
<assign to="probeInput{foo}">"bar"</assign>
<process handler="TemplateProcessor" operation="process" output="probeOut">
  <input name="syntax">"freemarker"</input>
  <input name="template">'${input?is_hash?c}:${input.foo}'</input>
  <input name="parameters">probeInput</input>
</process>
<!-- expect probeOut == "true:bar"; if you get "false:..." or an error,
     TemplateProcessor is not passing hashes natively. -->
```

## How steps use it

### Direct object embedding

```yaml
- call:
    path: 'scriptlets/serializeJsonObject.xml'
    output: 'serializedResource'
    inputs:
      input: '$$2'
- assign:
    to: 'valTplParams{resourceJson}'
    value: '$serializedResource{jsonString}'
- process:
    handler: 'TemplateProcessor'
    ...
    inputs:
      template: "'{\"resource\":${resourceJson},...}'"
```

`${resourceJson}` is now a JSON string, safe to embed unquoted in
another JSON body.

### Raw-body POST (no envelope)

```yaml
- call:
    path: 'scriptlets/serializeJsonObject.xml'
    output: 'serialized'
    inputs:
      input: '$$2'
- send:
    ...
    inputs:
      body: '$serialized{jsonString}'
```

Used by the `transforms via ... with map ...` step: smart-helper's
`/transform` endpoint takes the FHIR resource as the raw HTTP body, no
JSON envelope needed.

### When NOT to use it

For **known-shape scalar bundles** (like COSE `_raw`, which is exactly
three base64 strings), pull each subfield with its own `JsonPointer`
extraction and rebuild inline with `?json_string`. That path uses only
primitives that work on every ITB build regardless of whether
`TemplateProcessor` passes hashes natively — worth having as a fallback
for the highest-signal test paths.

## Rejected alternatives

1. **Modify upstream helpers to return `_json` string fields alongside
   objects.** Fixes it for one caller, doesn't scale — every helper
   would have to serialize every field the tests might pointer into.
   Also splits the invariant "the JSON on the wire is the JSON in the
   response" across N services.
2. **Add a native `JsonSerializerProcessor` action to the ITB.** Right
   answer long-term; wrong answer today, because the workbench can't
   ship an ITB patch.
3. **Extend the workbench IR with a first-class `serialize` action
   type** and generate the equivalent XML directly. Adds a code path,
   changes the type system, requires bumping the schema. The scriptlet
   approach is one file and doesn't touch the generator. Revisit if we
   ever have three or more of these composition primitives.

## Related

- Reference test with all four broken sites (before fix): `dist/features/
  ph4h-qr-integration.feature` → generated XML in the itb-starter.
- Root-cause discussion and initial diagnosis:
  `E:/work/itb-starter/HCERT_PH4H___QR_to_MEOW_MedicationOverview_Bundle/
  tc-ph4h-qr-001-qr-decode-transform-meow-conformance.xml`.
- Upstream services affected: `E:/work/WHO-ITB/gdhcn-helper/app.py`,
  `E:/work/WHO-ITB/smart-helper/main.py`.
