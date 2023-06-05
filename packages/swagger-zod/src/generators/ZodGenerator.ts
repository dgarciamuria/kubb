/* eslint-disable no-param-reassign */
import { pascalCase } from 'change-case'
import uniqueId from 'lodash.uniqueid'

import type { PluginContext } from '@kubb/core'
import { getUniqueName, SchemaGenerator } from '@kubb/core'
import type { Oas, OpenAPIV3, Refs } from '@kubb/swagger'
import { isReference } from '@kubb/swagger'

import { pluginName } from '../plugin.ts'
import { zodParser, zodKeywords } from '../parsers/index.ts'

import type { ZodMeta, ZodKeyword } from '../parsers/index.ts'
import type ts from 'typescript'

type Options = {
  withJSDocs?: boolean
  resolveName: PluginContext['resolveName']
}
export class ZodGenerator extends SchemaGenerator<Options, OpenAPIV3.SchemaObject, string[]> {
  // Collect the types of all referenced schemas so we can export them later
  refs: Refs = {}

  extraTexts: string[] = []

  aliases: ts.TypeAliasDeclaration[] = []

  // Keep track of already used type aliases
  usedAliasNames: Record<string, number> = {}

  constructor(public readonly oas: Oas, options: Options = { withJSDocs: true, resolveName: ({ name }) => name }) {
    super(options)

    return this
  }

  build(schema: OpenAPIV3.SchemaObject, baseName: string, description?: string) {
    const texts: string[] = []
    const zodInput = this.getTypeFromSchema(schema, baseName)
    if (description) {
      texts.push(`
      /**
       * @description ${description}
       */`)
    }

    const zodOutput = zodParser(zodInput, this.options.resolveName({ name: baseName, pluginName }) || baseName)

    texts.push(zodOutput)

    return [...this.extraTexts, ...texts]
  }

  /**
   * Creates a type node from a given schema.
   * Delegates to getBaseTypeFromSchema internally and
   * optionally adds a union with null.
   */
  private getTypeFromSchema(schema: OpenAPIV3.SchemaObject, baseName?: string): ZodMeta[] {
    const validationFunctions = this.getBaseTypeFromSchema(schema, baseName)
    if (validationFunctions) {
      return validationFunctions
    }

    return []
  }

  /**
   * Recursively creates a type literal with the given props.
   */
  private getTypeFromProperties(baseSchema?: OpenAPIV3.SchemaObject, baseName?: string): ZodMeta[] {
    const props = baseSchema?.properties || {}
    const required = baseSchema?.required
    const additionalProperties = baseSchema?.additionalProperties

    const objectMembers = Object.keys(props)
      .map((name) => {
        const validationFunctions: ZodMeta[] = []

        const schema = props[name] as OpenAPIV3.SchemaObject
        const isRequired = required && required.includes(name)

        validationFunctions.push(...this.getTypeFromSchema(schema as OpenAPIV3.SchemaObject, name))

        if (this.options.withJSDocs && schema.description) {
          validationFunctions.push({ keyword: 'describe', args: `\`${schema.description.replaceAll('\n', ' ').replaceAll('`', "'")}\`` })
        }
        const min = schema.minimum ?? schema.minLength ?? undefined
        const max = schema.maximum ?? schema.maxLength ?? undefined
        const matches = schema.pattern ?? undefined

        if (min !== undefined) {
          validationFunctions.push({ keyword: 'min', args: min })
        }
        if (max !== undefined) {
          validationFunctions.push({ keyword: 'max', args: max })
        }
        if (matches) {
          validationFunctions.push({ keyword: 'matches', args: `/${matches}/` })
        }

        if (!isRequired) {
          validationFunctions.push({ keyword: 'optional' })
        }

        return {
          [name]: validationFunctions,
        }
      })
      .reduce((acc, curr) => ({ ...acc, ...curr }), {})

    const members: ZodMeta[] = []

    members.push({ keyword: 'object', args: objectMembers })

    if (additionalProperties) {
      const addionalValidationFunctions: ZodMeta[] =
        additionalProperties === true ? [{ keyword: 'any' }] : this.getTypeFromSchema(additionalProperties as OpenAPIV3.SchemaObject)

      members.push({ keyword: 'catchall', args: addionalValidationFunctions })
    }

    return members
  }

  /**
   * Create a type alias for the schema referenced by the given ReferenceObject
   */
  private getRefAlias(obj: OpenAPIV3.ReferenceObject, baseName?: string): ZodMeta[] {
    const { $ref } = obj
    let ref = this.refs[$ref]

    if (ref) {
      return [{ keyword: 'ref', args: ref.name ?? ref.propertyName }]
    }

    const originalName = pascalCase(getUniqueName($ref.replace(/.+\//, ''), this.usedAliasNames), { delimiter: '' })
    const propertyName = this.options.resolveName({ name: originalName, pluginName }) || originalName

    if (originalName === baseName) {
      // eslint-disable-next-line no-multi-assign
      ref = this.refs[$ref] = {
        propertyName,
        originalName,
        name: uniqueId(propertyName),
      }

      return [{ keyword: 'ref', args: ref.name }]
    }

    // eslint-disable-next-line no-multi-assign
    ref = this.refs[$ref] = {
      propertyName,
      originalName,
    }

    return [{ keyword: 'ref', args: ref.propertyName }]
  }

  /**
   * This is the very core of the OpenAPI to TS conversion - it takes a
   * schema and returns the appropriate type.
   */
  private getBaseTypeFromSchema(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined, baseName?: string): ZodMeta[] {
    if (!schema) {
      return [{ keyword: 'any' }]
    }

    if (isReference(schema)) {
      return this.getRefAlias(schema, baseName)
    }

    if (schema.oneOf) {
      // union
      const schemaWithoutOneOf = { ...schema, oneOf: undefined }

      const union: ZodMeta = {
        keyword: 'union',
        args: schema.oneOf.map((item) => {
          return this.getBaseTypeFromSchema(item)[0]
        }),
      }
      if (schemaWithoutOneOf.properties) {
        return [...this.getBaseTypeFromSchema(schemaWithoutOneOf, baseName), union]
      }

      return [union]
    }

    if (schema.anyOf) {
      // TODO anyOf -> union
    }
    if (schema.allOf) {
      // intersection/add
      const schemaWithoutAllOf = { ...schema, allOf: undefined }

      const and: ZodMeta = {
        keyword: 'and',
        args: schema.allOf.map((item) => {
          return this.getBaseTypeFromSchema(item)[0]
        }),
      }

      if (schemaWithoutAllOf.properties) {
        return [...this.getBaseTypeFromSchema(schemaWithoutAllOf, baseName), and]
      }

      return [{ keyword: 'object', args: {} }, and]
    }

    if (schema.enum) {
      if ('x-enumNames' in schema) {
        return [
          {
            keyword: 'enum',
            args: [`[${[...new Set(schema['x-enumNames'] as string[])].map((value) => `\`${value}\``).join(', ')}]`],
          },
        ]
      }

      return [
        {
          keyword: 'enum',
          args: [`[${[...new Set(schema.enum)].map((value) => `\`${value}\``).join(', ')}]`],
        },
      ]
    }

    if ('items' in schema) {
      // items -> array
      return [{ keyword: 'array', args: this.getTypeFromSchema(schema.items as OpenAPIV3.SchemaObject, baseName) }]
    }

    if ('prefixItems' in schema) {
      const prefixItems = schema.prefixItems as OpenAPIV3.SchemaObject[]

      return [
        {
          keyword: 'tuple',
          args: prefixItems.map((item) => {
            // no baseType so we can fall back on an union when using enum
            return this.getBaseTypeFromSchema(item, undefined)![0]
          }),
        },
      ]
    }

    if (schema.properties || schema.additionalProperties) {
      // properties -> literal type
      return this.getTypeFromProperties(schema, baseName)
    }

    if (schema.type) {
      if (Array.isArray(schema.type)) {
        // OPENAPI v3.1.0: https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0
        const [type] = schema.type

        return [
          ...this.getBaseTypeFromSchema(
            {
              ...schema,
              type,
            },
            baseName
          ),
          { keyword: 'null' },
        ]
      }

      // string, boolean, null, number
      if (schema.type in zodKeywords) {
        return [{ keyword: schema.type as ZodKeyword }]
      }
    }

    if (schema.format === 'binary') {
      // TODO binary
    }

    return [{ keyword: 'any' }]
  }
}
