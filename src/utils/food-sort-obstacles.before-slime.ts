// Food Sort obstacle helpers.
//
// Purpose:
// Keeps obstacle rules separate from the main
// match-3 engine so the game stays easy to understand.

export type FoodSortObstacleType =
  | 'ice'
  | 'rock'
  | 'vine';


export type FoodSortObstacleCell = {
  type: FoodSortObstacleType;

  // 1 = one match breaks it.
  // 2 = two matches break it.
  health: number;
};


export type FoodSortObstacleBoard =
  Array<FoodSortObstacleCell | null>;


export type FoodSortObstacleResult = {
  obstacles: FoodSortObstacleBoard;

  hit: number;

  cleared: number;
};


// Purpose:
// Creates repeatable random positions using
// the level number.
//
// This means the same level starts with
// the same obstacle arrangement.
function createSeededRandom(
  seed: number,
) {
  let value =
    Math.max(
      1,
      seed,
    );


  return function random() {
    value =
      (
        value * 9301 +
        49297
      ) %
      233280;


    return (
      value /
      233280
    );
  };
}


// Purpose:
// Randomizes board positions for obstacles.
function shuffledPositions(
  boardSize: number,
  level: number,
) {
  const positions =
    Array.from(
      {
        length:
          boardSize,
      },
      (_, index) =>
        index,
    );


  const random =
    createSeededRandom(
      level * 73,
    );


  for (
    let index =
      positions.length - 1;

    index > 0;

    index -= 1
  ) {
    const swapIndex =
      Math.floor(
        random() *
        (
          index + 1
        ),
      );


    const temporary =
      positions[index];


    positions[index] =
      positions[swapIndex];


    positions[swapIndex] =
      temporary;
  }


  return positions;
}


// Purpose:
// Creates obstacles based on the player's level.
//
// Level 1-15:
// No obstacles.
//
// Level 16+:
// Ice starts appearing.
//
// Level 26+:
// Strong ice needs two matches.
export function createFoodSortObstacleBoard(
  level: number,
  obstacleBudget: number,
  boardSize = 36,
): FoodSortObstacleBoard {
  const obstacles:
    FoodSortObstacleBoard =
      Array(
        boardSize,
      ).fill(
        null,
      );


  if (
    level < 16 ||
    obstacleBudget <= 0
  ) {
    return obstacles;
  }


  const positions =
    shuffledPositions(
      boardSize,
      level,
    );


  let positionIndex = 0;


  // ==========================================================
  // LEVEL 16+
  // ICE
  // ==========================================================

  const iceCount =
    level >= 31
      ? Math.min(
          6,
          Math.max(
            2,
            Math.ceil(
              obstacleBudget /
              6,
            ),
          ),
        )
      : Math.min(
          12,
          Math.max(
            2,
            Math.ceil(
              obstacleBudget /
              3,
            ),
          ),
        );


  const iceHealth =
    level >= 26
      ? 2
      : 1;


  for (
    let index = 0;

    index < iceCount &&
    positionIndex <
      positions.length;

    index += 1
  ) {
    const position =
      positions[
        positionIndex
      ];

    positionIndex += 1;


    obstacles[position] = {
      type:
        'ice',

      health:
        iceHealth,
    };
  }


  // ==========================================================
  // LEVEL 31+
  // ROCK
  // ==========================================================

  if (
    level >= 31
  ) {
    const rockCount =
      Math.min(
        10,

        Math.max(
          2,

          Math.ceil(
            obstacleBudget /
            4,
          ),
        ),
      );


    const rockHealth =
      level >= 45
        ? 3
        : 2;


    for (
      let index = 0;

      index < rockCount &&
      positionIndex <
        positions.length;

      index += 1
    ) {
      const position =
        positions[
          positionIndex
        ];

      positionIndex += 1;


      obstacles[position] = {
        type:
          'rock',

        health:
          rockHealth,
      };
    }
  }


  // ==========================================================
  // LEVEL 51+
  // VINES
  // ==========================================================

  if (
    level >= 51
  ) {
    const vineCount =
      Math.min(
        10,

        Math.max(
          2,

          Math.ceil(
            obstacleBudget /
            5,
          ),
        ),
      );


    const vineHealth =
      level >= 70
        ? 2
        : 1;


    for (
      let index = 0;

      index < vineCount &&
      positionIndex <
        positions.length;

      index += 1
    ) {
      const position =
        positions[
          positionIndex
        ];

      positionIndex += 1;


      obstacles[position] = {
        type:
          'vine',

        health:
          vineHealth,
      };
    }
  }


  return obstacles;
}


// Purpose:
// Damages Ice, Rock, or Vine obstacles when the food
// underneath is included in a successful match.
export function damageFoodSortObstacles(
  current:
    FoodSortObstacleBoard,

  matchedIndexes:
    Set<number>,
): FoodSortObstacleResult {
  const next =
    current.map(
      obstacle =>
        obstacle
          ? {
              ...obstacle,
            }
          : null,
    );


  let hit = 0;

  let cleared = 0;


  for (
    const index
    of matchedIndexes
  ) {
    const obstacle =
      next[index];


    if (
      !obstacle
    ) {
      continue;
    }


    hit += 1;


    const nextHealth =
      obstacle.health - 1;


    if (
      nextHealth <= 0
    ) {
      next[index] =
        null;

      cleared += 1;

      continue;
    }


    next[index] = {
      ...obstacle,

      health:
        nextHealth,
    };
  }


  return {
    obstacles:
      next,

    hit,

    cleared,
  };
}


// Purpose:
// Counts obstacles still remaining.
export function countFoodSortObstacles(
  obstacles:
    FoodSortObstacleBoard,
) {
  return obstacles.filter(
    obstacle =>
      obstacle !== null,
  ).length;
}
