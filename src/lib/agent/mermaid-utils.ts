/**
 * Utilities for generating, repairing, and validating Mermaid ER diagrams.
 */

import type { SchemaInfo } from "./db.server";

/**
 * Normalizes PostgreSQL data types to clean, valid Mermaid ER attribute types.
 */
export function normalizeMermaidType(rawType: string): string {
  if (!rawType) return "string";
  const lower = rawType.toLowerCase().trim();

  if (
    lower.includes("char") ||
    lower.includes("text") ||
    lower.includes("uuid") ||
    lower.includes("varchar")
  ) {
    return "string";
  }
  if (lower.includes("bigint") || lower.includes("int8")) {
    return "bigint";
  }
  if (lower.includes("int") || lower.includes("serial")) {
    return "int";
  }
  if (
    lower.includes("num") ||
    lower.includes("dec") ||
    lower.includes("real") ||
    lower.includes("float") ||
    lower.includes("double")
  ) {
    return "float";
  }
  if (lower.includes("bool")) {
    return "boolean";
  }
  if (
    lower.includes("time") ||
    lower.includes("date") ||
    lower.includes("timestamp")
  ) {
    return "datetime";
  }
  if (lower.includes("json")) {
    return "json";
  }
  // Sanitize any spaces or unusual characters into a safe alphanumeric string
  const clean = lower.replace(/[^a-z0-9_]/g, "");
  return clean || "string";
}

/**
 * Ensures identifier names are safe for Mermaid ER diagrams.
 */
export function sanitizeMermaidIdentifier(name: string): string {
  if (!name) return "field";
  const clean = name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  return clean || "field";
}

/**
 * Programmatically generates a 100% syntactically valid Mermaid ER diagram
 * from a real database SchemaInfo structure.
 */
export function generateMermaidERFromSchema(schema: SchemaInfo): string {
  if (!schema || !schema.tables || schema.tables.length === 0) {
    throw new Error(
      "Unable to generate the ER diagram because the database schema could not be retrieved or contains no tables."
    );
  }

  const lines: string[] = ["erDiagram"];

  // Render Entities
  for (const tableObj of schema.tables) {
    const tableName = sanitizeMermaidIdentifier(tableObj.table);
    lines.push(`    ${tableName} {`);

    for (const col of tableObj.columns) {
      const type = normalizeMermaidType(col.type);
      const name = sanitizeMermaidIdentifier(col.name);
      const isPk = name === "id" || name.endsWith("_id") && col.name === `${tableObj.table.replace(/s$/, "")}_id`;
      
      // Determine FK from relationships metadata
      const isFk = schema.relationships.some(
        (rel) => rel.from_table === tableObj.table && rel.from_column === col.name
      );

      let keySuffix = "";
      if (isPk) {
        keySuffix = " PK";
      } else if (isFk) {
        keySuffix = " FK";
      }

      // Attributes MUST be on separate lines
      lines.push(`        ${type} ${name}${keySuffix}`);
    }

    lines.push("    }");
  }

  // Render Foreign Key Relationships
  const addedRels = new Set<string>();
  for (const rel of schema.relationships) {
    const fromTable = sanitizeMermaidIdentifier(rel.from_table);
    const toTable = sanitizeMermaidIdentifier(rel.to_table);
    const relKey = `${toTable}_to_${fromTable}`;

    if (!addedRels.has(relKey) && fromTable !== toTable) {
      addedRels.add(relKey);
      lines.push(`    ${toTable} ||--o{ ${fromTable} : ${sanitizeMermaidIdentifier(rel.from_column)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Repairs common LLM syntax errors in Mermaid erDiagram strings.
 * Specifically fixes comma-separated attributes on a single line:
 * `string customer_id PK, string name, string email` -> splits onto separate lines.
 */
export function repairMermaidERDiagram(mermaidText: string): string {
  if (!mermaidText.includes("erDiagram")) {
    return mermaidText;
  }

  const lines = mermaidText.split("\n");
  const repairedLines: string[] = [];
  let insideBlock = false;

  for (let line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes("{")) {
      insideBlock = true;
      repairedLines.push(line);
      continue;
    }

    if (trimmed.includes("}")) {
      insideBlock = false;
      repairedLines.push(line);
      continue;
    }

    if (insideBlock && trimmed.includes(",")) {
      // Fix comma-separated attribute lines
      const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        // Indent properly
        repairedLines.push(`        ${part}`);
      }
      continue;
    }

    repairedLines.push(line);
  }

  return repairedLines.join("\n");
}
