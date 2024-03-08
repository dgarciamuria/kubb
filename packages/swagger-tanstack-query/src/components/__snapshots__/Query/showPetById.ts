type ShowPetByIdClient = typeof client<ShowPetByIdQueryResponse, never, never>
type ShowPetById = {
  data: ShowPetByIdQueryResponse
  error: never
  request: never
  pathParams: ShowPetByIdPathParams
  queryParams: never
  headerParams: never
  response: ShowPetByIdQueryResponse
  client: {
    parameters: Partial<Parameters<ShowPetByIdClient>[0]>
    return: Awaited<ReturnType<ShowPetByIdClient>>
  }
}

export const ShowPetByIdQueryKey = (petId: ShowPetByIdPathParams['petId'], testId: ShowPetByIdPathParams['testId']) =>
  [{ url: '/pets/:petId', params: { petId: petId } }] as const
export type ShowPetByIdQueryKey = ReturnType<typeof ShowPetByIdQueryKey>
export function ShowPetByIdQueryOptions<TData = ShowPetById['response'], TQueryData = ShowPetById['response']>(
  petId: ShowPetByIdPathParams['petId'],
  testId: ShowPetByIdPathParams['testId'],
  options: ShowPetById['client']['parameters'] = {},
): WithRequired<UseBaseQueryOptions<ShowPetById['response'], ShowPetById['error'], TData, TQueryData>, 'queryKey'> {
  const queryKey = ShowPetByIdQueryKey(petId, testId)

  return {
    queryKey,
    queryFn: async () => {
      const res = await client<ShowPetById['data'], ShowPetById['error']>({
        method: 'get',
        url: `/pets/${petId}`,
        ...options,
      })

      return res.data
    },
  }
}
/**
 * @summary Info for a specific pet
 * @link /pets/:petId */

export function useShowPetById<TData = ShowPetById['response'], TQueryData = ShowPetById['response'], TQueryKey extends QueryKey = ShowPetByIdQueryKey>(
  petId: ShowPetByIdPathParams['petId'],
  testId: ShowPetByIdPathParams['testId'],
  options: {
    query?: Partial<UseBaseQueryOptions<ShowPetById['response'], ShowPetById['error'], TData, TQueryData, TQueryKey>>
    client?: ShowPetById['client']['parameters']
  } = {},
): UseQueryResult<TData, ShowPetById['error']> & { queryKey: TQueryKey } {
  const { query: queryOptions, client: clientOptions = {} } = options ?? {}
  const queryKey = queryOptions?.queryKey ?? ShowPetByIdQueryKey(petId, testId)

  const query = useQuery<ShowPetById['data'], ShowPetById['error'], TData, any>({
    ...ShowPetByIdQueryOptions<TData, TQueryData>(petId, testId, clientOptions),
    queryKey,
    ...queryOptions,
  }) as UseQueryResult<TData, ShowPetById['error']> & { queryKey: TQueryKey }

  query.queryKey = queryKey as TQueryKey

  return query
}