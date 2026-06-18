export interface RecipientFilter {
  roles?: string[]        // e.g. ['VS', 'CS']
  cityNames?: string[]    // e.g. ['Mumbai', 'Delhi NCR']
  examId?: string         // only users assigned to this exam
  userIds?: string[]      // explicit list (overrides other filters)
}
