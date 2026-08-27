import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

import {
  areFoodSortTilesAdjacent,
  createEmptyCollected,
  createFoodSortBoard,
  findFoodSortMatches,
  resolveFoodSortBoard,
  swapFoodSortTiles,
  type FoodSortCollected,
  type FoodSortFoodId,
  type FoodSortTile,
} from '@/utils/food-sort-game';

import {
  createFoodSortLevel,
  type FoodSortLevelGoal,
} from '@/utils/food-sort-level';


const companionImage =
  require(
    '../../assets/images/tabIcons/companion.png',
  );


// ============================================================
// FOOD ART
// Uses food PNGs already inside Mission Trails.
// ============================================================

const FOOD_ART:
  Record<
    FoodSortFoodId,
    {
      label: string;
      image:
        ImageSourcePropType;
    }
  > = {
  treat: {
    label: 'Treat',
    image: require(
      '../../assets/images/companionfoodicons/bakedtreatssweets-happines/aurorapudding.png',
    ),
  },

  carrot: {
    label: 'Carrot',
    image: require(
      '../../assets/images/companionfoodicons/fruitsquick-energy/embercarrot.png',
    ),
  },

  berry: {
    label: 'Berry',
    image: require(
      '../../assets/images/companionfoodicons/fruitsquick-energy/cosmicberry.png',
    ),
  },

  drink: {
    label: 'Drink',
    image: require(
      '../../assets/images/companionfoodicons/drinks-recovery/electrowaterbottle.png',
    ),
  },

  meal: {
    label: 'Meal',
    image: require(
      '../../assets/images/companionfoodicons/proteinfullmeals-hungerrestoration/powerbowl.png',
    ),
  },
};


const BOARD_GAP = 4;
const BOARD_PADDING = 6;


// Purpose: Gives the screen a safe Level 1
// while permanent progress loads from Supabase.
const INITIAL_LEVEL =
  createFoodSortLevel(1);


type GameStatus =
  | 'playing'
  | 'won'
  | 'lost';


// Purpose: Adds newly matched foods to the
// player's current level totals.
function addCollectedFood(
  current:
    FoodSortCollected,
  earned:
    FoodSortCollected,
) {
  const next = {
    ...current,
  };

  next.treat += earned.treat;
  next.carrot += earned.carrot;
  next.berry += earned.berry;
  next.drink += earned.drink;
  next.meal += earned.meal;

  return next;
}


// Purpose: Checks if every level goal has
// been completed.
function goalsAreComplete(
  collected:
    FoodSortCollected,

  goals:
    FoodSortLevelGoal[],
) {
  return goals.every(
    (goal) =>
      collected[goal.foodId] >=
      goal.target,
  );
}


// Purpose: Renders the playable Mission Trails
// Companion Food Sort game.
export default function CompanionFoodSortScreen() {
  const router = useRouter();

  const safeArea =
    useSafeAreaInsets();

  const { width } =
    useWindowDimensions();


  const [
    levelConfig,
    setLevelConfig,
  ] =
    useState(
      INITIAL_LEVEL,
    );


  const [board, setBoard] =
    useState<FoodSortTile[]>(
      () =>
        createFoodSortBoard(),
    );

  const [
    selectedIndex,
    setSelectedIndex,
  ] =
    useState<number | null>(
      null,
    );

  const [moves, setMoves] =
    useState(
      INITIAL_LEVEL.moves,
    );

  const [score, setScore] =
    useState(0);

  const [
    collected,
    setCollected,
  ] =
    useState<FoodSortCollected>(
      () =>
        createEmptyCollected(),
    );

  const [
    gameStatus,
    setGameStatus,
  ] =
    useState<GameStatus>(
      'playing',
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      'Tap a food, then tap a food beside it.',
    );

  const [
    runId,
    setRunId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isStartingRun,
    setIsStartingRun,
  ] =
    useState(false);

  const [
    isClaimingReward,
    setIsClaimingReward,
  ] =
    useState(false);

  const [
    rewardMessage,
    setRewardMessage,
  ] =
    useState<string | null>(
      null,
    );


  // Purpose: Makes the 6x6 board fit on
  // different phone screen sizes.
  const tileSize =
    useMemo(() => {
      const maximumBoardWidth =
        Math.min(
          width - 20,
          430,
        );

      return Math.floor(
        (
          maximumBoardWidth -
          BOARD_PADDING * 2 -
          BOARD_GAP * 5
        ) / 6,
      );
    }, [width]);


  const actualBoardWidth =
    tileSize * 6 +
    BOARD_GAP * 5 +
    BOARD_PADDING * 2;


  // Purpose: Starts one secure Food Sort run on Supabase.
  async function startServerRun() {
    setIsStartingRun(true);
    setRunId(null);
    setRewardMessage(null);

    try {
      // Purpose: Loads the permanent Food Sort
      // level saved on the player's account.
      const {
        data: progressData,
        error: progressError,
      } =
        await supabase.rpc(
          'server_get_food_sort_progress',
        );

      if (progressError) {
        throw progressError;
      }

      const progress =
        progressData &&
        typeof progressData === 'object'
          ? progressData as Record<string, unknown>
          : {};

      const serverLevel =
        Math.max(
          1,
          Number(
            progress.currentLevel ??
            1,
          ),
        );

      const nextLevel =
        createFoodSortLevel(
          serverLevel,
        );


      const { data, error } =
        await supabase.rpc(
          'server_start_food_sort_run',
        );

      if (error) {
        throw error;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (
        !result?.started ||
        !result?.run_id
      ) {
        throw new Error(
          String(
            result?.result_code ??
            'Food Sort run could not start.',
          ),
        );
      }

      setRunId(
        String(result.run_id),
      );

      setLevelConfig(
        nextLevel,
      );

      setBoard(
        createFoodSortBoard(),
      );

      setSelectedIndex(
        null,
      );

      setMoves(
        nextLevel.moves,
      );

      setScore(0);

      setCollected(
        createEmptyCollected(),
      );

      setGameStatus(
        'playing',
      );

      setMessage(
        nextLevel.bossLevel
          ? `LEVEL ${nextLevel.level} CHECKPOINT! The kitchen just got tougher. 🔥`
          : `Level ${nextLevel.level} ready! Match the food goals.`,
      );
    } catch (error) {
      console.warn(
        '[Food Sort] Could not start secure run.',
        error,
      );

      setMessage(
        'Food Sort could not connect to the reward server.',
      );
    } finally {
      setIsStartingRun(false);
    }
  }


  // Purpose: Claims the fixed server-owned reward after a win.
  async function claimWinReward(
    completedRunId: string,
    finalScore: number,
    finalMoves: number,
  ) {
    if (isClaimingReward) {
      return;
    }

    setIsClaimingReward(true);
    setRewardMessage(
      'Claiming Mission Trails rewards...',
    );

    try {
      const { data, error } =
        await supabase.rpc(
          'server_complete_food_sort_run',
          {
            p_run_id:
              completedRunId,

            p_score:
              finalScore,

            p_moves_remaining:
              finalMoves,
          },
        );

      if (error) {
        throw error;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!result?.completed) {
        const code =
          String(
            result?.result_code ??
            '',
          );

        if (
          code ===
          'RUN_TOO_FAST'
        ) {
          setRewardMessage(
            'That level finished too quickly for a secure reward. Play again for rewards.',
          );
        } else {
          setRewardMessage(
            'Level completed, but the reward could not be verified.',
          );
        }

        return;
      }

      const explorerPoints =
        Number(
          result.explorer_points ??
          0,
        );

      const carrotQuantity =
        Number(
          result.carrot_quantity ??
          0,
        );

      const treatQuantity =
        Number(
          result.treat_quantity ??
          0,
        );

      if (result.rewarded) {
        setRewardMessage(
          `REWARDED! +${explorerPoints} Explorer Score • +${carrotQuantity} Ember Carrot • +${treatQuantity} Aurora Pudding • +5 Bond • +5 Happiness 🎁`,
        );
      } else {
        setRewardMessage(
          `+${explorerPoints} Explorer Score. Today's free Food Sort food rewards are already used.`,
        );
      }
    } catch (error) {
      console.warn(
        '[Food Sort] Reward claim failed.',
        error,
      );

      setRewardMessage(
        'Level completed, but the reward server could not be reached.',
      );
    } finally {
      setIsClaimingReward(false);
    }
  }


  // Purpose: Starts Level 1 over from scratch.
  async function restartGame() {
    setMessage(
      'Loading your next Food Sort challenge...',
    );

    await startServerRun();
  }


  // Purpose: Creates the first secure run when the screen opens.
  useEffect(() => {
    void startServerRun();
  }, []);


  // Purpose: Handles selecting and swapping food.
  function pressTile(
    index: number,
  ) {
    if (
      gameStatus !==
        'playing' ||
      !runId ||
      isStartingRun ||
      isClaimingReward
    ) {
      return;
    }


    // First tap selects a food.
    if (
      selectedIndex === null
    ) {
      setSelectedIndex(index);

      setMessage(
        'Now tap a food beside it.',
      );

      return;
    }


    // Tapping the same food cancels selection.
    if (
      selectedIndex === index
    ) {
      setSelectedIndex(null);

      setMessage(
        'Selection canceled.',
      );

      return;
    }


    // The second food must be directly beside
    // the first one.
    if (
      !areFoodSortTilesAdjacent(
        selectedIndex,
        index,
      )
    ) {
      setSelectedIndex(index);

      setMessage(
        'Foods must be beside each other. New food selected.',
      );

      return;
    }


    const swappedBoard =
      swapFoodSortTiles(
        board,
        selectedIndex,
        index,
      );


    // A swap only counts if it creates a match.
    const firstMatch =
      findFoodSortMatches(
        swappedBoard,
      );


    if (
      firstMatch.size === 0
    ) {
      setSelectedIndex(null);

      setMessage(
        'No match. Try another swap.',
      );

      return;
    }


    // Resolve the match and any new cascades.
    const result =
      resolveFoodSortBoard(
        swappedBoard,
      );


    const nextCollected =
      addCollectedFood(
        collected,
        result.collected,
      );


    const nextMoves =
      moves - 1;


    const nextScore =
      score + result.score;

    setBoard(result.board);
    setCollected(nextCollected);
    setScore(nextScore);
    setMoves(nextMoves);
    setSelectedIndex(null);


    // Player wins immediately when all goals
    // have been collected.
    if (
      goalsAreComplete(
        nextCollected,
        levelConfig.goals,
      )
    ) {
      setGameStatus('won');

      setMessage(
        'LEVEL COMPLETE! Your companion is celebrating! 🎉',
      );

      void claimWinReward(
        runId,
        nextScore,
        nextMoves,
      );

      return;
    }


    // Player loses when the final move is used
    // without finishing all goals.
    if (nextMoves <= 0) {
      setGameStatus('lost');

      setMessage(
        'Out of moves. Try the level again!',
      );

      return;
    }


    if (
      result.mythicsCreated > 0
    ) {
      setMessage(
        'MYTHIC TREAT CREATED! ✦ Match it to unleash a huge clear!',
      );
    } else if (
      result.specialsCreated > 0
    ) {
      setMessage(
        'POWER SNACK CREATED! 💥 Match it again to blast a row or column!',
      );
    } else if (
      result.powerActivations > 0
    ) {
      setMessage(
        `POWER COMBO! ${result.powerActivations} special effect${result.powerActivations === 1 ? '' : 's'} activated! 💥`,
      );
    } else if (
      result.cascades > 1
    ) {
      setMessage(
        `${result.cascades}x CASCADE! 🔥`,
      );
    } else {
      setMessage(
        'Nice match! Keep going.',
      );
    }
  }


  return (
    <LinearGradient
      colors={[
        '#030007',
        '#11041C',
        '#080016',
        '#030007',
      ]}
      style={styles.screen}
    >
      <StatusBar
        style="light"
      />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              safeArea.top + 12,

            paddingBottom:
              safeArea.bottom + 30,
          },
        ]}
      >
        {/* HEADER */}
        <View
          style={
            styles.header
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Companion games"
            onPress={() =>
              router.back()
            }
            style={
              styles.backButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color="#FFFFFF"
            />
          </Pressable>

          <View
            style={
              styles.headerCopy
            }
          >
            <Text
              style={
                styles.title
              }
            >
              COMPANION FOOD SORT
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              LEVEL {levelConfig.level} • {levelConfig.name.toUpperCase()}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restart level"
            onPress={
              restartGame
            }
            style={
              styles.restartIcon
            }
          >
            <Ionicons
              name="refresh"
              size={21}
              color="#62E7FF"
            />
          </Pressable>
        </View>


        {/* COMPANION */}
        <View
          style={
            styles.companionCard
          }
        >
          <View
            style={
              styles.companionOrb
            }
          >
            <Image
              source={
                companionImage
              }
              resizeMode="contain"
              style={
                styles.companionImage
              }
            />
          </View>

          <View
            style={
              styles.companionCopy
            }
          >
            <Text
              style={
                styles.companionLabel
              }
            >
              YOUR COMPANION
            </Text>

            <Text
              style={
                styles.companionMessage
              }
            >
              {gameStatus ===
              'won'
                ? 'YUM! We got everything! 💜'
                : gameStatus ===
                    'lost'
                  ? 'Almost! Let’s try again.'
                  : 'Match my food before the moves run out!'}
            </Text>
          </View>
        </View>


        {/* SCORE */}
        <View
          style={
            styles.statRow
          }
        >
          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              GAME SCORE
            </Text>

            <Text
              style={
                styles.statValue
              }
            >
              {score.toLocaleString()}
            </Text>
          </View>

          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statLabel
              }
            >
              MOVES
            </Text>

            <Text
              style={[
                styles.statValue,
                moves <= 5
                  ? styles.movesLow
                  : undefined,
              ]}
            >
              {moves}
            </Text>
          </View>
        </View>


        <View
          style={
            styles.difficultyCard
          }
        >
          <View>
            <Text
              style={
                styles.difficultyLabel
              }
            >
              DIFFICULTY TIER
            </Text>

            <Text
              style={
                styles.difficultyValue
              }
            >
              {levelConfig.difficultyTier}
            </Text>
          </View>

          <View
            style={
              styles.difficultyCopy
            }
          >
            <Text
              style={
                styles.difficultyName
              }
            >
              {levelConfig.name}
            </Text>

            <Text
              style={
                styles.difficultyText
              }
            >
              {levelConfig.bossLevel
                ? 'Checkpoint challenge • harder goals'
                : `${levelConfig.moves} moves • goals increase as you climb`}
            </Text>
          </View>

          {levelConfig.bossLevel ? (
            <Ionicons
              name="flame"
              size={24}
              color="#FF765E"
            />
          ) : null}
        </View>


        {/* GOALS */}
        <View
          style={
            styles.goalSection
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            LEVEL GOALS
          </Text>

          <View
            style={
              styles.goalRow
            }
          >
            {levelConfig.goals.map(
              (goal) => {
                const amount =
                  collected[
                    goal.foodId
                  ];

                const complete =
                  amount >=
                  goal.target;

                return (
                  <View
                    key={
                      goal.foodId
                    }
                    style={[
                      styles.goalCard,

                      complete
                        ? styles.goalComplete
                        : undefined,
                    ]}
                  >
                    <Image
                      source={
                        FOOD_ART[
                          goal.foodId
                        ].image
                      }
                      resizeMode="contain"
                      style={
                        styles.goalImage
                      }
                    />

                    <Text
                      style={
                        styles.goalText
                      }
                    >
                      {Math.min(
                        amount,
                        goal.target,
                      )}
                      /{goal.target}
                    </Text>

                    {complete ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#6CFFA4"
                      />
                    ) : null}
                  </View>
                );
              },
            )}
          </View>
        </View>


        {/* SECURE REWARD STATUS */}
        {rewardMessage ? (
          <View
            style={
              styles.rewardCard
            }
          >
            <Ionicons
              name="gift"
              size={18}
              color="#72F2C3"
            />

            <Text
              style={
                styles.rewardText
              }
            >
              {rewardMessage}
            </Text>
          </View>
        ) : null}


        {/* GAME MESSAGE */}
        <View
          style={
            styles.messageCard
          }
        >
          <Ionicons
            name={
              gameStatus ===
              'won'
                ? 'trophy'
                : gameStatus ===
                    'lost'
                  ? 'refresh'
                  : 'sparkles'
            }
            size={18}
            color="#FFD75E"
          />

          <Text
            style={
              styles.messageText
            }
          >
            {message}
          </Text>
        </View>


        {/* 6x6 BOARD */}
        <View
          style={[
            styles.board,
            {
              width:
                actualBoardWidth,
            },
          ]}
        >
          {board.map(
            (
              tile,
              index,
            ) => {
              const selected =
                selectedIndex ===
                index;

              return (
                <Pressable
                  key={
                    tile.id
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    FOOD_ART[
                      tile.foodId
                    ].label
                  }
                  disabled={
                    gameStatus !==
                      'playing' ||
                    !runId ||
                    isStartingRun ||
                    isClaimingReward
                  }
                  onPress={() =>
                    pressTile(
                      index,
                    )
                  }
                  style={[
                    styles.tile,

                    {
                      width:
                        tileSize,

                      height:
                        tileSize,
                    },

                    selected
                      ? styles.tileSelected
                      : undefined,
                  ]}
                >
                  <Image
                    source={
                      FOOD_ART[
                        tile.foodId
                      ].image
                    }
                    resizeMode="contain"
                    style={
                      styles.tileImage
                    }
                  />

                  {tile.special !== 'none' ? (
                    <View
                      style={[
                        styles.specialBadge,
                        tile.special === 'mythic'
                          ? styles.specialBadgeMythic
                          : undefined,
                      ]}
                    >
                      <Text
                        style={
                          styles.specialBadgeText
                        }
                      >
                        {tile.special === 'row'
                          ? '↔'
                          : tile.special === 'column'
                            ? '↕'
                            : '✦'}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            },
          )}
        </View>


        {/* END OF LEVEL */}
        {gameStatus !==
        'playing' ? (
          <View
            style={
              styles.resultCard
            }
          >
            <Ionicons
              name={
                gameStatus ===
                'won'
                  ? 'trophy'
                  : 'refresh-circle'
              }
              size={44}
              color={
                gameStatus ===
                'won'
                  ? '#FFD75E'
                  : '#FF5AA9'
              }
            />

            <Text
              style={
                styles.resultTitle
              }
            >
              {gameStatus ===
              'won'
                ? 'LEVEL COMPLETE!'
                : 'TRY AGAIN'}
            </Text>

            <Text
              style={
                styles.resultScore
              }
            >
              Game Score:{' '}
              {score.toLocaleString()}
            </Text>

            <Text
              style={
                styles.resultNote
              }
            >
              {isClaimingReward
                ? 'Verifying your secure Mission Trails reward...'
                : rewardMessage ??
                  'Your level result has been sent to Mission Trails.'}
            </Text>

            <Pressable
              onPress={
                restartGame
              }
              style={
                styles.restartButton
              }
            >
              <Ionicons
                name="refresh"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.restartText
                }
              >
                {gameStatus === 'won'
                  ? 'NEXT LEVEL'
                  : 'TRY AGAIN'}
              </Text>
            </Pressable>
          </View>
        ) : null}


        <Text
          style={
            styles.helper
          }
        >
          Match 3 or more identical foods.
          Invalid swaps do not use a move.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}


const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
    },

    content: {
      alignItems:
        'center',

      paddingHorizontal:
        10,

      gap: 14,
    },

    header: {
      width: '100%',
      maxWidth: 620,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 12,
    },

    backButton: {
      width: 44,
      height: 44,

      borderRadius: 22,

      borderWidth: 1,

      borderColor:
        '#8F3BFF',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(10, 4, 22, 0.92)',
    },

    restartIcon: {
      width: 44,
      height: 44,

      borderRadius: 22,

      borderWidth: 1,

      borderColor:
        '#245B70',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(3, 16, 25, 0.92)',
    },

    headerCopy: {
      flex: 1,
    },

    title: {
      color: '#FFFFFF',

      fontSize: 18,

      fontWeight:
        '900',

      letterSpacing: 0.7,
    },

    subtitle: {
      color: '#62E7FF',

      fontSize: 11,

      fontWeight:
        '800',

      marginTop: 3,
    },

    companionCard: {
      width: '100%',
      maxWidth: 430,

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        '#713388',

      backgroundColor:
        'rgba(19, 6, 30, 0.95)',

      flexDirection:
        'row',

      alignItems:
        'center',

      padding: 12,

      gap: 13,
    },

    companionOrb: {
      width: 70,
      height: 70,

      borderRadius: 35,

      borderWidth: 2,

      borderColor:
        '#CF45FF',

      backgroundColor:
        '#08030E',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    companionImage: {
      width: '82%',
      height: '82%',
    },

    companionCopy: {
      flex: 1,
    },

    companionLabel: {
      color: '#FF63E6',

      fontSize: 10,

      fontWeight:
        '900',

      letterSpacing: 1,
    },

    companionMessage: {
      color: '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '700',

      marginTop: 5,

      lineHeight: 19,
    },

    statRow: {
      width: '100%',
      maxWidth: 430,

      flexDirection:
        'row',

      gap: 10,
    },

    statCard: {
      flex: 1,

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        '#342441',

      backgroundColor:
        'rgba(8, 5, 16, 0.95)',

      paddingVertical: 10,

      alignItems:
        'center',
    },

    statLabel: {
      color: '#8E8298',

      fontSize: 9,

      fontWeight:
        '900',

      letterSpacing: 0.8,
    },

    statValue: {
      color: '#FFFFFF',

      fontSize: 23,

      fontWeight:
        '900',

      marginTop: 2,
    },

    movesLow: {
      color: '#FF597F',
    },

    difficultyCard: {
      width: '100%',
      maxWidth: 430,

      minHeight: 68,

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        '#49305A',

      backgroundColor:
        'rgba(15, 7, 24, 0.96)',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal: 14,

      paddingVertical: 10,

      gap: 14,
    },

    difficultyLabel: {
      color: '#7D7186',

      fontSize: 8,

      fontWeight:
        '900',

      letterSpacing: 0.8,
    },

    difficultyValue: {
      color: '#FFFFFF',

      fontSize: 25,

      fontWeight:
        '900',

      textAlign: 'center',
    },

    difficultyCopy: {
      flex: 1,
    },

    difficultyName: {
      color: '#E45FFF',

      fontSize: 13,

      fontWeight:
        '900',
    },

    difficultyText: {
      color: '#A99BB5',

      fontSize: 9,

      marginTop: 3,
    },

    goalSection: {
      width: '100%',
      maxWidth: 430,
    },

    sectionTitle: {
      color: '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '900',

      letterSpacing: 1,

      marginBottom: 7,
    },

    goalRow: {
      flexDirection:
        'row',

      gap: 8,
    },

    goalCard: {
      flex: 1,

      minHeight: 60,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#403049',

      backgroundColor:
        'rgba(8, 5, 16, 0.96)',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 4,

      paddingHorizontal: 5,
    },

    goalComplete: {
      borderColor:
        '#4FCF79',

      backgroundColor:
        'rgba(23, 70, 40, 0.35)',
    },

    goalImage: {
      width: 28,
      height: 28,
    },

    goalText: {
      color: '#FFFFFF',

      fontSize: 11,

      fontWeight:
        '900',
    },

    rewardCard: {
      width: '100%',
      maxWidth: 430,

      minHeight: 50,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#315E52',

      backgroundColor:
        'rgba(18, 65, 52, 0.35)',

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal: 12,

      gap: 9,
    },

    rewardText: {
      flex: 1,

      color: '#C7FFE9',

      fontSize: 11,

      fontWeight:
        '800',

      lineHeight: 16,
    },

    messageCard: {
      width: '100%',
      maxWidth: 430,

      minHeight: 44,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        '#614C2C',

      backgroundColor:
        'rgba(49, 34, 6, 0.36)',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 12,

      gap: 8,
    },

    messageText: {
      flex: 1,

      color: '#FFF4C6',

      fontSize: 11,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    board: {
      flexDirection:
        'row',

      flexWrap: 'wrap',

      gap: BOARD_GAP,

      padding:
        BOARD_PADDING,

      borderRadius: 20,

      borderWidth: 2,

      borderColor:
        '#7F38B8',

      backgroundColor:
        'rgba(4, 2, 10, 0.98)',
    },

    tile: {
      borderRadius: 10,

      borderWidth: 1,

      borderColor:
        '#392447',

      backgroundColor:
        '#13091A',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    tileSelected: {
      borderWidth: 3,

      borderColor:
        '#62E7FF',

      backgroundColor:
        '#182B34',
    },

    tileImage: {
      width: '84%',
      height: '84%',
    },

    specialBadge: {
      position: 'absolute',

      right: 2,
      bottom: 2,

      minWidth: 21,
      height: 21,

      borderRadius: 11,

      borderWidth: 1,

      borderColor:
        '#62E7FF',

      backgroundColor:
        '#103647',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 3,
    },

    specialBadgeMythic: {
      borderColor:
        '#FFD75E',

      backgroundColor:
        '#50350A',
    },

    specialBadgeText: {
      color: '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '900',
    },

    resultCard: {
      width: '100%',
      maxWidth: 430,

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        '#9143C1',

      backgroundColor:
        'rgba(18, 5, 28, 0.97)',

      alignItems:
        'center',

      padding: 20,
    },

    resultTitle: {
      color: '#FFFFFF',

      fontSize: 23,

      fontWeight:
        '900',

      marginTop: 8,
    },

    resultScore: {
      color: '#62E7FF',

      fontSize: 15,

      fontWeight:
        '900',

      marginTop: 5,
    },

    resultNote: {
      color: '#A99BB5',

      fontSize: 11,

      lineHeight: 17,

      textAlign:
        'center',

      marginTop: 8,

      maxWidth: 320,
    },

    restartButton: {
      minWidth: 180,

      minHeight: 46,

      borderRadius: 99,

      marginTop: 15,

      backgroundColor:
        '#922BFF',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 7,
    },

    restartText: {
      color: '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '900',

      letterSpacing: 0.7,
    },

    helper: {
      color: '#746A7C',

      fontSize: 10,

      textAlign:
        'center',

      maxWidth: 350,

      lineHeight: 15,
    },
  });
