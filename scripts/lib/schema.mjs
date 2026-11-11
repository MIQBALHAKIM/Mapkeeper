const TYPES = {
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
  null: (v) => v === null,
};

export function validate(instance, schema, root = schema, path = "$") {
  const errors = [];
  if (!schema || typeof schema !== "object") return errors;

  if (schema.$ref) {
    const target = resolveRef(schema.$ref, root);
    if (!target) {
      errors.push(`${path}: unresolved $ref ${schema.$ref}`);
      return errors;
    }
    return validate(instance, target, root, path);
  }

  if (schema.anyOf) {
    const results = schema.anyOf.map((s) => validate(instance, s, root, path));
    if (!results.some((r) => r.length === 0)) {
      errors.push(`${path}: does not match any allowed shape`);
      errors.push(...results[0]);
      return errors;
    }
  }

  if (schema.const !== undefined && instance !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.includes(instance)) {
    errors.push(`${path}: ${JSON.stringify(instance)} is not one of ${schema.enum.join(", ")}`);
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = allowed.some((t) => TYPES[t]?.(instance));
    if (!ok) {
      errors.push(`${path}: expected ${allowed.join("|")}, got ${typeName(instance)}`);
      return errors;
    }
  }

  if (typeof instance === "string") {
    if (schema.minLength !== undefined && instance.length < schema.minLength) {
      errors.push(`${path}: shorter than ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && instance.length > schema.maxLength) {
      errors.push(`${path}: longer than ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(instance)) {
      errors.push(`${path}: does not match ${schema.pattern}`);
    }
  }

  if (typeof instance === "number") {
    if (schema.minimum !== undefined && instance < schema.minimum) {
      errors.push(`${path}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && instance > schema.maximum) {
      errors.push(`${path}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(instance)) {
    if (schema.minItems !== undefined && instance.length < schema.minItems) {
      errors.push(`${path}: needs at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && instance.length > schema.maxItems) {
      errors.push(`${path}: allows at most ${schema.maxItems} items`);
    }
    if (schema.items) {
      instance.forEach((item, i) => errors.push(...validate(item, schema.items, root, `${path}[${i}]`)));
    }
  }

  if (TYPES.object(instance)) {
    for (const key of schema.required || []) {
      if (!(key in instance)) errors.push(`${path}: missing required property "${key}"`);
    }
    const props = schema.properties || {};
    for (const [key, value] of Object.entries(instance)) {
      if (props[key]) {
        errors.push(...validate(value, props[key], root, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${key}"`);
      }
    }
  }

  return errors;
}

function resolveRef(ref, root) {
  if (!ref.startsWith("#/")) return null;
  return ref
    .slice(2)
    .split("/")
    .reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), root);
}

function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}