import type {
  Trail,
  TrailFilters,
  TrailMeetup,
} from '@/types/trails';


export const EMPTY_TRAIL_FILTERS:
  TrailFilters = {
    selected: [],
  };


// Purpose:
// Returns a YYYY-MM-DD value using the
// phone's LOCAL calendar date.
function getLocalDateKey(
  date = new Date(),
) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );


  return (
    `${year}-${month}-${day}`
  );
}


// Purpose:
// Checks whether a meetup belongs to
// today's local calendar date.
function isToday(
  dateValue: string,
) {

  return (
    dateValue
      .trim()
      .slice(
        0,
        10
      ) ===
    getLocalDateKey()
  );
}


// Purpose:
// Checks the selected distance-away filter
// using the trail's real GPS distance from
// the current user.
function matchesDistanceFilter(
  trail: Trail,
  selected:
    Set<TrailFilters['selected'][number]>,
) {

  if (
    selected.has(
      'under_3'
    )
  ) {

    return (
      trail.distanceMiles <
      3
    );
  }


  if (
    selected.has(
      '3_5'
    )
  ) {

    return (
      trail.distanceMiles >=
        3 &&
      trail.distanceMiles <
        5
    );
  }


  if (
    selected.has(
      '5_plus'
    )
  ) {

    return (
      trail.distanceMiles >=
      5
    );
  }


  return true;
}


// Purpose:
// Filters trails using search text and
// all selected filter buttons.
export function filterTrails(
  trails: Trail[],
  filters: TrailFilters,
  meetups: TrailMeetup[],
  query: string,
) {

  const selected =
    new Set(
      filters.selected
    );


  const normalizedQuery =
    query
      .trim()
      .toLowerCase();


  return trails.filter(
    (trail) => {

      // Purpose:
      // Creates one searchable string containing trail names,
      // places, addresses, and provider ZIP/postal codes.
      const searchable =
        [
          trail.name,
          trail.city,
          trail.address ?? '',
          trail.activityType,
          trail.category,
          trail.difficulty,
          trail.accessibility,
        ]
          .join(' ')
          .toLowerCase();


      const searchMatches =
        !normalizedQuery ||
        searchable.includes(
          normalizedQuery
        );


      const activityFilters =
        [
          'walking',
          'hiking',
        ].filter(
          (key) =>
            selected.has(
              key as
                | 'walking'
                | 'hiking'
            )
        );


      const activityMatches =
        activityFilters.length ===
          0 ||
        activityFilters.includes(
          trail.activityType
        );


      const parkMatches =
        !selected.has(
          'parks'
        ) ||
        trail.category ===
          'park';


      const difficultyFilters =
        [
          'easy',
          'moderate',
          'challenging',
        ].filter(
          (key) =>
            selected.has(
              key as
                | 'easy'
                | 'moderate'
                | 'challenging'
            )
        );


      const difficultyMatches =
        difficultyFilters.length ===
          0 ||
        difficultyFilters.includes(
          trail.difficulty
        );


      const distanceMatches =
        matchesDistanceFilter(
          trail,
          selected
        );


      const nearMatches =
        !selected.has(
          'near_me'
        ) ||
        trail.distanceMiles <=
          25;


      const accessibilityMatches =
        !selected.has(
          'accessible'
        ) ||
        trail.accessible;


      const meetupMatches =
        !selected.has(
          'meetups_today'
        ) ||
        meetups.some(
          (meetup) =>
            meetup.trailId ===
              trail.id &&
            isToday(
              meetup.date
            )
        );


      return (
        searchMatches &&
        activityMatches &&
        parkMatches &&
        difficultyMatches &&
        distanceMatches &&
        nearMatches &&
        accessibilityMatches &&
        meetupMatches
      );
    }
  );
}
