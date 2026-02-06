export interface CalendarFilters {
  startDate: string
  endDate: string
  types?: string[]
  platforms?: string[]
  responsibleId?: string
  priorities?: string[]
  contentType?: string
}

export interface KanbanFilters {
  priorities?: string[]
  responsibleId?: string
  contentType?: string
  platforms?: string[]
  brand?: string
  search?: string
}
