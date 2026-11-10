export type FilterableCareer = {
  title: string;
  locationCode: string;
};

/** A combined location such as HAM / KW appears in both locations. */
export function filterCareers<T extends FilterableCareer>(
  jobs: readonly T[],
  location: string,
  role: string,
): T[] {
  return jobs.filter(job => {
    const matchesLocation = location === "all" || job.locationCode.split(/\s*\/\s*/).includes(location);
    return matchesLocation && (role === "all" || job.title === role);
  });
}
