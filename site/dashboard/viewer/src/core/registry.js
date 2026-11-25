/* register(Class): the one way a component (stock or a box's own) becomes a tag (viewer/CONTRACT.md §7, §8). It checks
   the class's static schema against bb-component/1 and refuses a broken one loudly, then defines the element. */

import { checkSchema, formatErrors } from './validate.js';

const catalogue = new Map();

export function register(Class, { stock = null } = {}) {
  const schema = Class.schema;
  const errs = checkSchema(schema, { stock });
  if (errs.length) throw new Error(`${schema?.tag || Class.name}: bad component schema\n${formatErrors(errs)}`);
  if (!customElements.get(schema.tag)) customElements.define(schema.tag, Class);
  catalogue.set(schema.tag, schema);
  return Class;
}

/** {tag: schema} of every registered component (what bb-page validates a template against). */
export function registered() { return Object.fromEntries(catalogue); }
