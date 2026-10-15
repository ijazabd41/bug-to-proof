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
  if ("testId" in definition.assertion) target(definition.assertion.testId, "assertion");
  else if (definition.assertion.type === "urlPathEquals") route(definition.assertion.expected, "assertion.expected");
  else if ("name" in definition.assertion && definition.assertion.name) control(definition.assertion.role, definition.assertion.name, "assertion");
  return { ok: findings.length === 0, findings };
}
