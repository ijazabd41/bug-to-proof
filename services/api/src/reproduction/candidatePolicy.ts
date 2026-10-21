import type { ReproductionDefinitionV1 } from "./definitionCompiler";
import { validateReproductionDefinition } from "./definitionCompiler";
import type { TargetDiscoverySnapshot } from "./targetDiscovery";

export interface CandidatePolicyResult { ok: boolean; findings: string[] }

export function validateCandidateAgainstDiscovery(input: unknown, discovery: TargetDiscoverySnapshot): CandidatePolicyResult {
  const parsed = validateReproductionDefinition(input);
  if (!parsed.ok) return { ok: false, findings: parsed.errors };
  const definition: ReproductionDefinitionV1 = parsed.value;
  const findings: string[] = [];
  const routes = new Set(discovery.routes);
  const controls = discovery.controls;
  const headings = new Set(discovery.headings.map(heading => `heading\0${heading.text}`));
  const products = new Set(discovery.fixtures.products.map(product => product.id));
  const targets = new Set((discovery.targets ?? []).map(target => target.testId));
  const target = (testId: string, at: string) => { if (!targets.has(testId)) findings.push(`${at}.testId is absent from the frozen target inventory`); };
  const route = (value: string, at: string) => { if (!routes.has(value)) findings.push(`${at} is absent from the frozen route inventory`); };
  const control = (role: string, name: string, at: string, within?: { kind: "product"; productId: number }) => {
    if (headings.has(`${role}\0${name}`) && !within) return;
    const matches = controls.filter(item => item.role === role && item.name === name && (!within || (item.context?.kind === within.kind && item.context.productId === within.productId)));
    if (matches.length === 0) findings.push(`${at} is absent from the frozen accessible inventory`);
    else if (!within && matches.length > 1) findings.push(`${at} is ambiguous in the frozen accessible inventory and requires discovered context`);
  };
  route(definition.startPath, "startPath");
  definition.preconditions.forEach((item, index) => {
    if (item.type === "seedCart" && !products.has(item.productId)) findings.push(`preconditions.${index}.productId is absent from frozen fixtures`);
    if (item.type === "seedCart" && definition.startPath !== "/") findings.push(`preconditions.${index}.seedCart requires startPath / to retain MiniShop in-memory state`);
    if (item.type === "clearLocalStorage" && definition.preconditions.slice(0, index).some(previous => previous.type === "seedCart")) {
      findings.push(`preconditions.${index}.clearLocalStorage must come before seedCart`);
    }
  });
  definition.steps.forEach((step, index) => {
    if (step.type === "goto") route(step.path, `steps.${index}.path`);
    if (step.type === "click" || step.type === "waitForVisible") control(step.role, step.name, `steps.${index}`, step.within);
    if (step.type === "clickTarget" || step.type === "fillTarget" || step.type === "waitForTargetVisible") target(step.testId, `steps.${index}`);
    if (step.type === "fill" || step.type === "selectOption") {
      const role = step.type === "fill" ? "textbox" : "combobox";
      control(role, step.label, `steps.${index}`);
    }
  });
  let stateMayHaveChanged = definition.preconditions.some(item => item.type === "seedCart");
  definition.steps.forEach((step, index) => {
    if ((step.type === "goto" || step.type === "reload") && stateMayHaveChanged) {
      findings.push(`steps.${index} hard navigation after an interactive state change can discard MiniShop in-memory state; use a discovered link`);
    }
    if (step.type === "click" && step.role !== "link" || step.type === "clickTarget" && !/^(nav-|back-to-)/.test(step.testId) ||
      step.type === "fill" || step.type === "fillTarget" || step.type === "selectOption") stateMayHaveChanged = true;
  });
  if (definition.assertion.type === "visibleTextEquals" && definition.assertion.role === "textbox") {
    findings.push("assertion reads textbox text content; use a discovered status or message target for visible feedback");
  }
  if (definition.assertion.type === "targetTextEquals") {
    const { testId, expected } = definition.assertion;
    if (/(?:-input|-button)$/.test(testId)) {
      findings.push("assertion reads a control's text content; use a discovered status or message target for visible feedback");
    }
    const productRow = (discovery.targets ?? []).find(item => item.testId === testId && /^cart-item-\d+$/.test(testId) && item.context?.productName === expected);
    if (productRow) findings.push("assertion compares an entire composite cart row with only a product name; use a name-specific target or assertion");
  }
  if (definition.assertion.type === "targetCurrencySumEquals") {
    target(definition.assertion.testId, "assertion");
    definition.assertion.terms.forEach((testId, index) => target(testId, `assertion.terms.${index}`));
  }
  else if ("testId" in definition.assertion) target(definition.assertion.testId, "assertion");
  else if (definition.assertion.type === "urlPathEquals") route(definition.assertion.expected, "assertion.expected");
  else if ("name" in definition.assertion && definition.assertion.name) control(definition.assertion.role, definition.assertion.name, "assertion");
  return { ok: findings.length === 0, findings };
}
