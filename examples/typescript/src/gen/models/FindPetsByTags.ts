import type { Pet } from './Pet'

/**
 * @description Invalid tag value
 */
export type FindPetsByTags400 = any | null

export type FindPetsByTagsQueryParams = {
  /**
   * @description Tags to filter by
   * @type array | undefined
   */
  tags?: string[] | undefined
  /**
   * @description to request with required page number or pagination
   * @type string | undefined
   */
  page?: string | undefined
  /**
   * @description to request with required page size
   * @type string | undefined
   */
  pageSize?: string | undefined
}

/**
 * @description successful operation
 */
export type FindPetsByTagsQueryResponse = Pet[]