import fs from "fs";
import path from "path";
import { digest, computeSourceManifest } from "../ai/repair/workspace";
import { listSourceFiles } from "../ai/repair/tools";

export interface DiscoveredControl {
  role: "button" | "link" | "textbox" | "combobox";
  name: string;
  sourcePath: string;
  context?: { kind: "product"; productId: number; productName: string };
}

export interface DiscoveredHeading {
  level: number;
  text: string;
  sourcePath: string;
}

export interface DiscoveredTarget {
  testId: string;
  sourcePath: string;
  context?: { kind: "product"; productId: number; productName: string };
}

export interface TargetDiscoverySnapshot {
  schemaVersion: "1.0";
  sourceFingerprint: string;
  inventoryDigest: string;
  routes: string[];
  controls: DiscoveredControl[];
  headings: DiscoveredHeading[];
  targets?: DiscoveredTarget[];
  fixtures: { products: Array<{ id: number; name: string; price: number }> };
  sourceFiles: string[];
  capturedAt: string;
}

export interface PersistedDiscoveryArtifact {
  artifactPath: string;
  artifactHash: string;
}

export interface TargetDiscoveryLimits {
  maxFiles: number;
  maxSourceBytes: number;
  maxControls: number;
  maxTextLength: number;
}

export const DEFAULT_TARGET_DISCOVERY_LIMITS: Readonly<TargetDiscoveryLimits> = Object.freeze({
  maxFiles: 100,
  maxSourceBytes: 250_000,
  maxControls: 200,
  maxTextLength: 200,
});

export function validateApplicationPath(value: string): string {
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    throw new Error(`Path must be application-relative: ${value}`);
  }
  return candidate;
}

function cleanText(value: string, maxLength: number): string {
  return stripBalancedJsxExpressions(value, true)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stripBalancedJsxExpressions(value: string, expressionsEverywhere = false): string {
  let output = "";
  let depth = 0;
  let inTag = false;
  let quote = "";
  let escaped = false;
  for (const char of value) {
    if (depth === 0) {
      if (char === "<") inTag = true;
      if ((inTag || expressionsEverywhere) && char === "{") { depth = 1; output += " "; }
      else { output += char; if (inTag && char === ">") inTag = false; }
      continue;
    }
    if (escaped) { escaped = false; continue; }
    if (quote) {
      if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth++;
    else if (char === "}" && --depth === 0) output += " ";
  }
  return output;
}

function attribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1];
}

function pushControl(controls: DiscoveredControl[], control: DiscoveredControl, maxControls: number): void {
  if (!control.name) return;
  if (controls.length >= maxControls) throw new Error(`Target discovery exceeded control limit of ${maxControls}`);
  if (!controls.some(item => item.role === control.role && item.name === control.name && item.sourcePath === control.sourcePath)) controls.push(control);
}

export function discoverTargetSurface(
  minishopDir: string,
  overrides: Partial<TargetDiscoveryLimits> = {},
): TargetDiscoverySnapshot {
  const limits = { ...DEFAULT_TARGET_DISCOVERY_LIMITS, ...overrides };
  const sourceRoot = path.join(minishopDir, "src");
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) throw new Error("MiniShop src directory is missing");
  if (fs.lstatSync(sourceRoot).isSymbolicLink()) throw new Error("Symlinked discovery roots are unsupported");

  const sourceFiles = listSourceFiles(minishopDir);
  if (sourceFiles.length > limits.maxFiles) throw new Error(`Target discovery exceeded file limit of ${limits.maxFiles}`);

  const contents: Array<{ sourcePath: string; content: string }> = [];
  let totalBytes = 0;
  for (const sourcePath of sourceFiles) {
    const fullPath = path.join(minishopDir, sourcePath);
    if (fs.lstatSync(fullPath).isSymbolicLink()) throw new Error(`Symlinked discovery input is unsupported: ${sourcePath}`);
    const size = fs.statSync(fullPath).size;
    totalBytes += size;
    if (totalBytes > limits.maxSourceBytes) throw new Error(`Target discovery exceeded source byte limit of ${limits.maxSourceBytes}`);
    contents.push({ sourcePath, content: fs.readFileSync(fullPath, "utf8") });
  }

  const routes = new Set<string>();
  const controls: DiscoveredControl[] = [];
  const headings: DiscoveredHeading[] = [];
  const targets: DiscoveredTarget[] = [];
  const products: Array<{ id: number; name: string; price: number }> = [];

  for (const { sourcePath, content: raw } of contents) {
    const content = stripBalancedJsxExpressions(raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""))
      .replace(/<input\b[^>]*type\s*=\s*["']hidden["'][^>]*\/?\s*>/gi, "");
    for (const match of content.matchAll(/<(?:Route)\b[^>]*\bpath\s*=\s*["']([^"']+)["'][^>]*>/g)) routes.add(validateApplicationPath(match[1]));
    for (const match of content.matchAll(/<(?:Link)\b([^>]*)>([\s\S]*?)<\/Link>/g)) {
      const target = attribute(match[1], "to");
      if (target) routes.add(validateApplicationPath(target));
      pushControl(controls, { role: "link", name: cleanText(attribute(match[1], "aria-label") ?? match[2], limits.maxTextLength), sourcePath }, limits.maxControls);
    }
    for (const match of content.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      pushControl(controls, { role: "button", name: cleanText(attribute(match[1], "aria-label") ?? match[2], limits.maxTextLength), sourcePath }, limits.maxControls);
    }
    for (const match of content.matchAll(/<(input|textarea|select)\b([^>]*)\/?\s*>/g)) {
      const tag = match[1].toLowerCase();
      const attrs = match[2];
      if ((attribute(attrs, "type") ?? "").toLowerCase() === "hidden") continue;
      const role = tag === "select" ? "combobox" : "textbox";
      const name = attribute(attrs, "aria-label") ?? attribute(attrs, "placeholder") ?? attribute(attrs, "name") ?? "";
      pushControl(controls, { role, name: cleanText(name, limits.maxTextLength), sourcePath }, limits.maxControls);
    }
    for (const match of content.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)) {
      const text = cleanText(match[2], limits.maxTextLength);
      if (text) headings.push({ level: Number(match[1]), text, sourcePath });
    }
    for (const match of raw.matchAll(/\{\s*id:\s*(\d+)\s*,\s*name:\s*["']([^"']+)["']\s*,\s*price:\s*(\d+(?:\.\d+)?)\s*\}/g)) {
      products.push({ id: Number(match[1]), name: cleanText(match[2], limits.maxTextLength), price: Number(match[3]) });
    }
  }

  for (const { sourcePath, content } of contents) {
    for (const match of content.matchAll(/data-testid\s*=\s*["']([A-Za-z0-9_-]+)["']/g)) {
      targets.push({ testId: match[1], sourcePath });
    }
    for (const match of content.matchAll(/data-testid\s*=\s*\{\s*`([^`]+)`\s*\}/g)) {
      const template = match[1].match(/^([A-Za-z0-9_-]*)\$\{(?:product\.id|productId)\}([A-Za-z0-9_-]*)$/);
      if (!template) continue;
      for (const product of products) {
        targets.push({ testId: `${template[1]}${product.id}${template[2]}`, sourcePath, context: { kind: "product", productId: product.id, productName: product.name } });
      }
    }
  }

  const contentByPath = new Map(contents.map(item => [item.sourcePath, item.content]));
  const contextualControls = controls.flatMap(control => {
    const source = contentByPath.get(control.sourcePath) ?? "";
    if (control.role !== "button" || products.length < 2 || !/\bproduct\.(?:id|name)\b/.test(source)) return [control];
    return products.map(product => ({ ...control, context: { kind: "product" as const, productId: product.id, productName: product.name } }));
  });
  contextualControls.sort((a, b) => `${a.role}:${a.name}:${a.sourcePath}:${a.context?.productId ?? ""}`.localeCompare(`${b.role}:${b.name}:${b.sourcePath}:${b.context?.productId ?? ""}`));
  headings.sort((a, b) => `${a.level}:${a.text}:${a.sourcePath}`.localeCompare(`${b.level}:${b.text}:${b.sourcePath}`));
  products.sort((a, b) => a.id - b.id);
  const uniqueTargets = [...new Map(targets.map(target => [`${target.testId}\0${target.sourcePath}`, target])).values()]
    .sort((a, b) => `${a.testId}:${a.sourcePath}`.localeCompare(`${b.testId}:${b.sourcePath}`));
  const sortedRoutes = [...routes].sort();
  const { fingerprint: sourceFingerprint } = computeSourceManifest(minishopDir);
  const canonicalInventory = { schemaVersion: "1.0" as const, sourceFingerprint, routes: sortedRoutes, controls: contextualControls, headings, targets: uniqueTargets, fixtures: { products }, sourceFiles };

  return {
    ...canonicalInventory,
    inventoryDigest: digest(JSON.stringify(canonicalInventory)),
    capturedAt: new Date().toISOString(),
  };
}

export function persistTargetDiscovery(snapshot: TargetDiscoverySnapshot, artifactDir: string): PersistedDiscoveryArtifact {
  fs.mkdirSync(artifactDir, { recursive: true });
  if (fs.lstatSync(artifactDir).isSymbolicLink()) throw new Error("Symlinked discovery artifact directories are unsupported");
  const artifactPath = path.join(artifactDir, "discovery.json");
  const temporaryPath = `${artifactPath}.${process.pid}.tmp`;
  const bytes = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(temporaryPath, bytes, "utf8");
  fs.renameSync(temporaryPath, artifactPath);
  return { artifactPath, artifactHash: digest(bytes) };
}
