import fs from "fs";
import path from "path";
import { digest } from "../ai/repair/workspace";
import { validateApplicationPath } from "./targetDiscovery";

export const COMPILER_VERSION = "1.4.0";
export const REPRODUCTION_DEFINITION_LIMITS = Object.freeze({
  maxBytes: 32_000, maxSteps: 20, maxPreconditions: 10, maxMappings: 20,
  maxTitleLength: 500, maxTextLength: 2_000, maxPathLength: 500,
});

const ROLES = ["button", "link", "textbox", "combobox", "heading", "status", "listitem", "row", "cell", "checkbox", "radio", "option", "alert"] as const;
type Role = typeof ROLES[number];
export type ReproductionLocatorContext = { kind: "product"; productId: number };

export type ReproductionPrecondition =
  | { type: "clearLocalStorage" }
  | { type: "seedCart"; productId: number; quantity: number };
export type ReproductionAction =
  | { type: "goto"; path: string }
  | { type: "click"; role: Role; name: string; within?: ReproductionLocatorContext }
  | { type: "fill"; label: string; text: string }
  | { type: "selectOption"; label: string; value: string }
  | { type: "waitForVisible"; role: Role; name: string; within?: ReproductionLocatorContext }
  | { type: "clickTarget"; testId: string }
  | { type: "fillTarget"; testId: string; text: string }
  | { type: "waitForTargetVisible"; testId: string }
  | { type: "reload" };
export type ReproductionAssertion =
  | { type: "visibleTextEquals"; role: Role; name: string; expected: string }
  | { type: "numberEquals"; role: Role; name: string; expected: number }
  | { type: "currencyEquals"; role: Role; name: string; expected: number; currency: string }
  | { type: "countEquals"; role: Role; name?: string; expected: number }
  | { type: "urlPathEquals"; expected: string }
  | { type: "visibilityEquals"; role: Role; name: string; visible: boolean }
  | { type: "accessibleAttributeEquals"; role: Role; name: string; attribute: `aria-${string}`; expected: string }
  | { type: "targetTextEquals"; testId: string; expected: string }
  | { type: "targetNumberEquals"; testId: string; expected: number }
  | { type: "targetCurrencyEquals"; testId: string; expected: number; currency: string }
  | { type: "targetCurrencySumEquals"; testId: string; terms: string[]; currency: string }
  | { type: "targetVisibilityEquals"; testId: string; visible: boolean };

export interface ReproductionDefinitionV1 {
  schemaVersion: "1.0";
  title: string;
  startPath: string;
  preconditions: ReproductionPrecondition[];
  steps: ReproductionAction[];
  assertion: ReproductionAssertion;
  rationale: string;
  reportMapping: Array<{ reportFact: string; definitionPath: string }>;
}

export type DefinitionValidationResult =
  | { ok: true; value: ReproductionDefinitionV1 }
  | { ok: false; errors: string[] };

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], at: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${at} contains unknown key '${key}'`);
}
function textValue(value: unknown, at: string, errors: string[], max: number = REPRODUCTION_DEFINITION_LIMITS.maxTextLength): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > max) { errors.push(`${at} must be a non-empty string of at most ${max} characters`); return false; }
  return true;
}
function roleValue(value: unknown, at: string, errors: string[]): value is Role {
  if (typeof value !== "string" || !(ROLES as readonly string[]).includes(value)) { errors.push(`${at} is not an allowed accessible role`); return false; }
  return true;
}
function relativePath(value: unknown, at: string, errors: string[]): value is string {
  if (!textValue(value, at, errors, REPRODUCTION_DEFINITION_LIMITS.maxPathLength)) return false;
  try { validateApplicationPath(value); return true; } catch { errors.push(`${at} must be application-relative`); return false; }
}
function finiteNumber(value: unknown, at: string, errors: string[]): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) { errors.push(`${at} must be a finite number`); return false; }
  return true;
}
function locatorContext(value: unknown, at: string, errors: string[]): void {
  if (value === undefined) return;
  if (!record(value)) { errors.push(`${at} must be an object`); return; }
  exactKeys(value, ["kind", "productId"], at, errors);
  if (value.kind !== "product") errors.push(`${at}.kind must equal 'product'`);
  finiteNumber(value.productId, `${at}.productId`, errors);
  if (!Number.isInteger(value.productId) || (value.productId as number) < 1) errors.push(`${at}.productId must be a positive integer`);
}

export function validateReproductionDefinition(input: unknown): DefinitionValidationResult {
  const errors: string[] = [];
  let value: unknown = input;
  if (typeof input === "string") {
    if (Buffer.byteLength(input, "utf8") > REPRODUCTION_DEFINITION_LIMITS.maxBytes) return { ok: false, errors: [`definition exceeds ${REPRODUCTION_DEFINITION_LIMITS.maxBytes} bytes`] };
    try { value = JSON.parse(input); } catch { return { ok: false, errors: ["definition is not valid JSON"] }; }
  }
  if (!record(value)) return { ok: false, errors: ["definition must be an object"] };
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > REPRODUCTION_DEFINITION_LIMITS.maxBytes) errors.push(`definition exceeds ${REPRODUCTION_DEFINITION_LIMITS.maxBytes} bytes`);
  exactKeys(value, ["schemaVersion", "title", "startPath", "preconditions", "steps", "assertion", "rationale", "reportMapping"], "definition", errors);
  if (value.schemaVersion !== "1.0") errors.push("schemaVersion must equal '1.0'");
  textValue(value.title, "title", errors, REPRODUCTION_DEFINITION_LIMITS.maxTitleLength);
  relativePath(value.startPath, "startPath", errors);
  textValue(value.rationale, "rationale", errors);

  if (!Array.isArray(value.preconditions) || value.preconditions.length > REPRODUCTION_DEFINITION_LIMITS.maxPreconditions) errors.push(`preconditions must contain at most ${REPRODUCTION_DEFINITION_LIMITS.maxPreconditions} items`);
  else value.preconditions.forEach((item, index) => {
    const at = `preconditions.${index}`;
    if (!record(item) || typeof item.type !== "string") { errors.push(`${at} must be an object with a type`); return; }
    if (item.type === "clearLocalStorage") exactKeys(item, ["type"], at, errors);
    else if (item.type === "seedCart") { exactKeys(item, ["type", "productId", "quantity"], at, errors); finiteNumber(item.productId, `${at}.productId`, errors); finiteNumber(item.quantity, `${at}.quantity`, errors); if ((item.quantity as number) < 1 || !Number.isInteger(item.quantity)) errors.push(`${at}.quantity must be a positive integer`); }
    else errors.push(`${at}.type is unsupported`);
  });

  if (!Array.isArray(value.steps) || value.steps.length > REPRODUCTION_DEFINITION_LIMITS.maxSteps) errors.push(`steps must contain at most ${REPRODUCTION_DEFINITION_LIMITS.maxSteps} items`);
  else value.steps.forEach((item, index) => validateAction(item, `steps.${index}`, errors));
  validateAssertion(value.assertion, "assertion", errors);

  if (!Array.isArray(value.reportMapping) || value.reportMapping.length > REPRODUCTION_DEFINITION_LIMITS.maxMappings) errors.push(`reportMapping must contain at most ${REPRODUCTION_DEFINITION_LIMITS.maxMappings} items`);
  else value.reportMapping.forEach((item, index) => {
    const at = `reportMapping.${index}`;
    if (!record(item)) { errors.push(`${at} must be an object`); return; }
    exactKeys(item, ["reportFact", "definitionPath"], at, errors);
    textValue(item.reportFact, `${at}.reportFact`, errors);
    textValue(item.definitionPath, `${at}.definitionPath`, errors, 500);
  });
  return errors.length ? { ok: false, errors } : { ok: true, value: value as unknown as ReproductionDefinitionV1 };
}

function validateAction(item: unknown, at: string, errors: string[]): void {
  if (!record(item) || typeof item.type !== "string") { errors.push(`${at} must be an object with a type`); return; }
  switch (item.type) {
    case "goto": exactKeys(item, ["type", "path"], at, errors); relativePath(item.path, `${at}.path`, errors); break;
    case "click": case "waitForVisible": exactKeys(item, ["type", "role", "name", "within"], at, errors); roleValue(item.role, `${at}.role`, errors); textValue(item.name, `${at}.name`, errors); locatorContext(item.within, `${at}.within`, errors); break;
    case "clickTarget": case "waitForTargetVisible": exactKeys(item, ["type", "testId"], at, errors); textValue(item.testId, `${at}.testId`, errors, 200); break;
    case "fillTarget": exactKeys(item, ["type", "testId", "text"], at, errors); textValue(item.testId, `${at}.testId`, errors, 200); textValue(item.text, `${at}.text`, errors); break;
    case "fill": exactKeys(item, ["type", "label", "text"], at, errors); textValue(item.label, `${at}.label`, errors); textValue(item.text, `${at}.text`, errors); break;
    case "selectOption": exactKeys(item, ["type", "label", "value"], at, errors); textValue(item.label, `${at}.label`, errors); textValue(item.value, `${at}.value`, errors); break;
    case "reload": exactKeys(item, ["type"], at, errors); break;
    default: errors.push(`${at}.type is unsupported`);
  }
}

function validateAssertion(item: unknown, at: string, errors: string[]): void {
  if (!record(item) || typeof item.type !== "string") { errors.push(`${at} must be an object with a type`); return; }
  const locator = () => { roleValue(item.role, `${at}.role`, errors); if (item.name !== undefined) textValue(item.name, `${at}.name`, errors); };
  switch (item.type) {
    case "visibleTextEquals": exactKeys(item, ["type", "role", "name", "expected"], at, errors); locator(); textValue(item.name, `${at}.name`, errors); textValue(item.expected, `${at}.expected`, errors); break;
    case "numberEquals": exactKeys(item, ["type", "role", "name", "expected"], at, errors); locator(); textValue(item.name, `${at}.name`, errors); finiteNumber(item.expected, `${at}.expected`, errors); break;
    case "currencyEquals": exactKeys(item, ["type", "role", "name", "expected", "currency"], at, errors); locator(); textValue(item.name, `${at}.name`, errors); finiteNumber(item.expected, `${at}.expected`, errors); if (typeof item.currency !== "string" || !/^[A-Z]{3}$/.test(item.currency)) errors.push(`${at}.currency must be an uppercase ISO-style code`); break;
    case "countEquals": exactKeys(item, ["type", "role", "name", "expected"], at, errors); locator(); finiteNumber(item.expected, `${at}.expected`, errors); if (!Number.isInteger(item.expected) || (item.expected as number) < 0) errors.push(`${at}.expected must be a non-negative integer`); break;
    case "urlPathEquals": exactKeys(item, ["type", "expected"], at, errors); relativePath(item.expected, `${at}.expected`, errors); break;
    case "visibilityEquals": exactKeys(item, ["type", "role", "name", "visible"], at, errors); locator(); textValue(item.name, `${at}.name`, errors); if (typeof item.visible !== "boolean") errors.push(`${at}.visible must be boolean`); break;
    case "accessibleAttributeEquals": exactKeys(item, ["type", "role", "name", "attribute", "expected"], at, errors); locator(); textValue(item.name, `${at}.name`, errors); if (typeof item.attribute !== "string" || !/^aria-[a-z-]+$/.test(item.attribute)) errors.push(`${at}.attribute must be an aria-* attribute`); textValue(item.expected, `${at}.expected`, errors); break;
    case "targetTextEquals":
      exactKeys(item, ["type", "testId", "expected"], at, errors); textValue(item.testId, `${at}.testId`, errors, 200); textValue(item.expected, `${at}.expected`, errors);
      if (typeof item.expected === "string" && /\b(equal(?:s)?|plus|sum|subtotal|shipping|minus|difference|multiplied|divided)\b/i.test(item.expected)) errors.push(`${at}.expected appears to be relational prose; use a trusted computed assertion`);
      break;
    case "targetNumberEquals": exactKeys(item, ["type", "testId", "expected"], at, errors); textValue(item.testId, `${at}.testId`, errors, 200); finiteNumber(item.expected, `${at}.expected`, errors); break;
    case "targetCurrencyEquals": exactKeys(item, ["type", "testId", "expected", "currency"], at, errors); textValue(item.testId, `${at}.testId`, errors, 200); finiteNumber(item.expected, `${at}.expected`, errors); if (typeof item.currency !== "string" || !/^[A-Z]{3}$/.test(item.currency)) errors.push(`${at}.currency must be an uppercase ISO-style code`); break;
    case "targetCurrencySumEquals":
      exactKeys(item, ["type", "testId", "terms", "currency"], at, errors); textValue(item.testId, `${at}.testId`, errors, 200);
      if (!Array.isArray(item.terms) || item.terms.length < 2 || item.terms.length > 10) errors.push(`${at}.terms must contain 2 to 10 target testIds`);
      else {
        item.terms.forEach((term, index) => textValue(term, `${at}.terms.${index}`, errors, 200));
        if (new Set(item.terms).size !== item.terms.length) errors.push(`${at}.terms must not contain duplicates`);
        if (typeof item.testId === "string" && item.terms.includes(item.testId)) errors.push(`${at}.terms must not include the result target`);
      }
      if (typeof item.currency !== "string" || !/^[A-Z]{3}$/.test(item.currency)) errors.push(`${at}.currency must be an uppercase ISO-style code`);
      break;
    case "targetVisibilityEquals": exactKeys(item, ["type", "testId", "visible"], at, errors); textValue(item.testId, `${at}.testId`, errors, 200); if (typeof item.visible !== "boolean") errors.push(`${at}.visible must be boolean`); break;
    default: errors.push(`${at}.type is unsupported`);
  }
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortDeep(value[key])]));
  return value;
}
export function canonicalizeReproductionDefinition(definition: ReproductionDefinitionV1): string {
  return JSON.stringify(sortDeep(definition));
}

export interface CompiledReproduction {
  compilerVersion: typeof COMPILER_VERSION; definitionHash: string; compiledHash: string; testIdentity: string; source: string;
}
const literal = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function compileReproductionDefinition(input: unknown, definitionId: string): CompiledReproduction {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(definitionId)) throw new Error("Invalid definition id");
  const validation = validateReproductionDefinition(input);
  if (!validation.ok) throw new Error(`Invalid reproduction definition: ${validation.errors.join("; ")}`);
  const definition = validation.value;
  const canonical = canonicalizeReproductionDefinition(definition);
  const definitionHash = digest(canonical);
  const testIdentity = `btp-${definitionId}-v1-${definitionHash.slice(0, 12)}`;
  let source = emitSource(definition, testIdentity, definitionHash)
    .replace(
      `  await page.goto(${literal(definition.startPath)});\n  for (const step of definition.steps) {`,
      `  if (!definition.preconditions.some((item) => item.type === "seedCart")) await page.goto(${literal(definition.startPath)});\n  for (const step of definition.steps) {`,
    )
    .replace(
      "const locate = (page: any, role: string, name?: string) =>",
      "const normalizeCurrencyCents = (value: string) => Math.round(normalizeNumber(value) * 100);\nconst locate = (page: any, role: string, name?: string) =>",
    )
    .replace(
      "const locate = (page: any, role: string, name?: string) => page.getByRole(role, name === undefined ? undefined : { name, exact: true });",
      "const locate = (page: any, role: string, name?: string) => page.getByRole(role, name === undefined ? undefined : { name, exact: true });\nconst locateInProduct = (page: any, productId: number) => page.getByTestId(`add-to-cart-${productId}`);\nconst locateAction = (page: any, action: any) => action.within?.kind === 'product' ? locateInProduct(page, action.within.productId) : locate(page, action.role, action.name);",
    )
    .replace("await locate(page, step.role, step.name).click()", "await locateAction(page, step).click()")
    .replace("else if (step.type === \"click\")", "else if (step.type === \"clickTarget\") await page.getByTestId(step.testId).click();\n    else if (step.type === \"fillTarget\") await page.getByTestId(step.testId).fill(step.text);\n    else if (step.type === \"waitForTargetVisible\") await expect(page.getByTestId(step.testId)).toBeVisible();\n    else if (step.type === \"click\")")
    .replace("expect(locate(page, step.role, step.name)).toBeVisible()", "expect(locateAction(page, step)).toBeVisible()")
    .replace("await page.evaluate(({ productId, quantity }) => localStorage.setItem(\"cart\", JSON.stringify([{ productId, quantity }])), precondition)", "await page.getByTestId(`add-to-cart-${precondition.productId}`).click({ clickCount: precondition.quantity })")
    .replace("await page.goto(\"/\"); await page.getByTestId(`add-to-cart-${precondition.productId}`)", "if (new URL(page.url()).pathname !== \"/\") await page.goto(\"/\"); await page.getByTestId(`add-to-cart-${precondition.productId}`)")
    .replace("if (assertion.type === \"urlPathEquals\")", "if (assertion.type === \"targetCurrencySumEquals\") { const resultTarget = page.getByTestId(assertion.testId); const resultExists = await resultTarget.count(); const termTargets = assertion.terms.map((testId) => page.getByTestId(testId)); const termCounts = await Promise.all(termTargets.map((target) => target.count())); const missing = resultExists !== 1 || termCounts.some((count) => count !== 1); const received = missing ? \"<missing-or-ambiguous>\" : normalizeCurrencyCents((await resultTarget.textContent()) ?? \"\") / 100; const expected = missing ? assertion.terms.join(\" + \") : (await Promise.all(termTargets.map(async (target) => normalizeCurrencyCents((await target.textContent()) ?? \"\")))).reduce((sum, value) => sum + value, 0) / 100; await assertWithEvidence(testInfo, assertion.type, expected, received, () => expect(received).toBe(expected)); }\n  else if (assertion.type === \"targetTextEquals\" || assertion.type === \"targetNumberEquals\" || assertion.type === \"targetCurrencyEquals\" || assertion.type === \"targetVisibilityEquals\") { const target = page.getByTestId(assertion.testId); const exists = await target.count(); const text = exists ? (await target.textContent()) ?? \"\" : \"\"; const received = assertion.type === \"targetVisibilityEquals\" ? exists > 0 && await target.isVisible() : !exists ? \"<missing>\" : assertion.type === \"targetTextEquals\" ? text.trim() : normalizeNumber(text); const expected = assertion.type === \"targetVisibilityEquals\" ? assertion.visible : assertion.expected; await assertWithEvidence(testInfo, assertion.type, expected, received, () => expect(received).toBe(expected)); }\n  else if (assertion.type === \"urlPathEquals\")");
  source = source.replace(
    "const exists = await target.count(); const text = exists ? (await target.textContent()) ?? \"\" : \"\"; const received = assertion.type === \"targetVisibilityEquals\" ? exists > 0 && await target.isVisible() : !exists ? \"<missing>\" : assertion.type === \"targetTextEquals\" ? text.trim() : normalizeNumber(text); const expected = assertion.type === \"targetVisibilityEquals\" ? assertion.visible : assertion.expected; await assertWithEvidence(testInfo, assertion.type, expected, received, () => expect(received).toBe(expected));",
    "const expected = assertion.type === \"targetVisibilityEquals\" ? assertion.visible : assertion.expected; const read = async () => { const exists = await target.count(); const text = exists ? (await target.textContent()) ?? \"\" : \"\"; return assertion.type === \"targetVisibilityEquals\" ? exists > 0 && await target.isVisible() : !exists ? \"<missing>\" : assertion.type === \"targetTextEquals\" ? text.trim() : normalizeNumber(text); }; const received = await waitForExpected(read, expected); await assertWithEvidence(testInfo, assertion.type, expected, received, () => expect(received).toBe(expected));",
  ).replace(
    "const locate = (page: any, role: string, name?: string) =>",
    "async function waitForExpected(read: () => Promise<unknown>, expected: unknown) { try { await expect.poll(read, { timeout: 3000, intervals: [100, 200, 400] }).toBe(expected); } catch { /* Preserve final assertion evidence. */ } return read(); }\nconst locate = (page: any, role: string, name?: string) =>",
  );
  return { compilerVersion: COMPILER_VERSION, definitionHash, compiledHash: digest(source), testIdentity, source };
}

function emitSource(d: ReproductionDefinitionV1, identity: string, definitionHash: string): string {
  return `// Generated by Bug-to-Proof compiler ${COMPILER_VERSION}; definition ${definitionHash}\nimport { test, expect } from "@playwright/test";\n\nconst definition = ${literal(d)} as const;\nconst normalizeNumber = (value: string) => Number(value.replace(/[^0-9.+-]/g, ""));\nconst locate = (page: any, role: string, name?: string) => page.getByRole(role, name === undefined ? undefined : { name, exact: true });\nasync function assertWithEvidence(testInfo: any, label: string, expected: unknown, received: unknown, check: () => void | Promise<void>) {\n  await testInfo.attach("btp-assertion", { body: JSON.stringify({ actual: String(received), expected: String(expected), label }), contentType: "application/json" });\n  try { await check(); } catch (error) { throw new Error(\`BTP_ASSERTION: \${label}\\nExpected: \${JSON.stringify(expected)}\\nReceived: \${JSON.stringify(received)}\\n\${error instanceof Error ? error.message : String(error)}\`); }\n}\n\ntest(${literal(identity)}, async ({ page }, testInfo) => {\n  for (const precondition of definition.preconditions) {\n    if (precondition.type === "clearLocalStorage") { await page.goto(${literal(d.startPath)}); await page.evaluate(() => localStorage.clear()); }\n    else if (precondition.type === "seedCart") { await page.goto("/"); await page.evaluate(({ productId, quantity }) => localStorage.setItem("cart", JSON.stringify([{ productId, quantity }])), precondition); }\n  }\n  await page.goto(${literal(d.startPath)});\n  for (const step of definition.steps) {\n    if (step.type === "goto") await page.goto(step.path);\n    else if (step.type === "click") await locate(page, step.role, step.name).click();\n    else if (step.type === "fill") await page.getByLabel(step.label, { exact: true }).fill(step.text);\n    else if (step.type === "selectOption") await page.getByLabel(step.label, { exact: true }).selectOption(step.value);\n    else if (step.type === "waitForVisible") await expect(locate(page, step.role, step.name)).toBeVisible();\n    else if (step.type === "reload") await page.reload();\n  }\n  const assertion = definition.assertion;\n  if (assertion.type === "urlPathEquals") { const received = new URL(page.url()).pathname; await assertWithEvidence(testInfo, assertion.type, assertion.expected, received, () => expect(received).toBe(assertion.expected)); }\n  else {\n    const target = locate(page, assertion.role, "name" in assertion ? assertion.name : undefined);\n    if (assertion.type === "countEquals") { const received = await target.count(); await assertWithEvidence(testInfo, assertion.type, assertion.expected, received, () => expect(received).toBe(assertion.expected)); }\n    else if (assertion.type === "visibilityEquals") { const received = await target.isVisible(); await assertWithEvidence(testInfo, assertion.type, assertion.visible, received, () => expect(received).toBe(assertion.visible)); }\n    else if (assertion.type === "accessibleAttributeEquals") { const received = await target.getAttribute(assertion.attribute); await assertWithEvidence(testInfo, assertion.type, assertion.expected, received, () => expect(received).toBe(assertion.expected)); }\n    else { const text = (await target.textContent()) ?? ""; const received = assertion.type === "visibleTextEquals" ? text.trim() : normalizeNumber(text); await assertWithEvidence(testInfo, assertion.type, assertion.expected, received, () => expect(received).toBe(assertion.expected)); }\n  }\n});\n`;
}

export function persistCompiledReproduction(input: unknown, runId: string, generatedRoot: string): CompiledReproduction & { filePath: string } {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(runId)) throw new Error("Invalid run id");
  const compiled = compileReproductionDefinition(input, runId);
  const root = path.resolve(generatedRoot);
  const directory = path.resolve(root, runId, "generated-test");
  if (directory !== root && !directory.startsWith(`${root}${path.sep}`)) throw new Error("Generated test path escaped its root");
  fs.mkdirSync(directory, { recursive: true });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error("Symlinked generated-test directories are unsupported");
  const filePath = path.join(directory, "reproduction.spec.ts");
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, compiled.source, "utf8");
  fs.renameSync(temporary, filePath);
  return { ...compiled, filePath };
}
