import {
  Ionicons,
} from '@expo/vector-icons';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  MissionTrailColors as C,
} from '@/constants/theme';


// Purpose:
// Searches the currently loaded trail catalog by name,
// or launches a real city / ZIP location search.
export function TrailSearchBar({
  value,
  onChangeText,
  onSubmitSearch,
  onUseLocation,
  isLocating = false,
  isSearching = false,
}: {
  value: string;

  onChangeText:
    (value: string) => void;

  onSubmitSearch:
    () => void;

  onUseLocation:
    () => void;

  isLocating?: boolean;
  isSearching?: boolean;
}) {

  return (

    <View style={styles.row}>

      <View style={styles.inputWrap}>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search trails or location"
          disabled={isSearching}
          hitSlop={10}
          onPress={onSubmitSearch}
          style={({ pressed }) =>
            pressed &&
            styles.pressed
          }
        >
          {isSearching ? (
            <ActivityIndicator
              size="small"
              color={C.cyan}
            />
          ) : (
            <Ionicons
              name="search"
              size={18}
              color={C.cyan}
            />
          )}
        </Pressable>


        <TextInput
          accessibilityLabel="Search trail, park, city, or ZIP code"
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={onChangeText}
          onSubmitEditing={
            onSubmitSearch
          }
          placeholder="Trail, park, city, or ZIP code"
          placeholderTextColor="#796B86"
          returnKeyType="search"
          style={styles.input}
          value={value}
        />


        {value ? (

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
            onPress={() =>
              onChangeText('')
            }
            style={({ pressed }) =>
              pressed &&
              styles.pressed
            }
          >

            <Ionicons
              name="close-circle"
              size={19}
              color={C.textMuted}
            />

          </Pressable>

        ) : null}

      </View>


      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Find trails around my current location"
        disabled={isLocating}
        onPress={onUseLocation}
        style={({ pressed }) => [
          styles.locationButton,

          isLocating &&
            styles.disabled,

          pressed &&
            styles.pressed,
        ]}
      >

        {isLocating ? (

          <ActivityIndicator
            color={C.cyan}
          />

        ) : (

          <Ionicons
            name="locate"
            size={21}
            color={C.cyan}
          />

        )}

      </Pressable>

    </View>
  );
}


const styles =
  StyleSheet.create({

    row: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 18,
      marginTop: 15,
    },

    inputWrap: {
      flex: 1,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      paddingHorizontal: 13,
    },

    input: {
      flex: 1,
      color: C.text,
      fontSize: 14,
      paddingVertical: 12,
    },

    locationButton: {
      width: 48,
      height: 48,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.cyan,
      backgroundColor: '#102436',
    },

    disabled: {
      opacity: 0.65,
    },

    pressed: {
      opacity: 0.72,
    },
  });
