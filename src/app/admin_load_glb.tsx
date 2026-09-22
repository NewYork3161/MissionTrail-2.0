// src/app/admin_load_glb.tsx

import React, {
  useCallback,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";


// ====================================================
// CONSTANTS
// ====================================================

const STORAGE_BUCKET = "companion-models";

const DEFAULT_HEALTH = 100;
const DEFAULT_ENERGY = 100;


// ====================================================
// TYPES
// ====================================================

type SelectedGLB = {
  name: string;
  size: number;
  type: string;
  file: File;
};

type UploadStatus =
  | "idle"
  | "uploading"
  | "success"
  | "error";


// ====================================================
// HELPERS
// ====================================================

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  const megabytes = kilobytes / 1024;

  return `${megabytes.toFixed(2)} MB`;
}


function createCompanionKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function sanitizeFileName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}


function isGLBFile(file: File) {
  return file.name
    .toLowerCase()
    .endsWith(".glb");
}


// ====================================================
// ADMIN GLB UPLOAD PAGE
// ====================================================

export default function AdminLoadGLBScreen() {
  const safeArea = useSafeAreaInsets();

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);


  // ==================================================
  // COMPANION INFORMATION
  // ==================================================

  const [companionName, setCompanionName] =
    useState("");

  const [companionKey, setCompanionKey] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [rarity, setRarity] =
    useState("common");

  const [baseHealth, setBaseHealth] =
    useState(String(DEFAULT_HEALTH));

  const [baseEnergy, setBaseEnergy] =
    useState(String(DEFAULT_ENERGY));


  // ==================================================
  // FILE
  // ==================================================

  const [selectedFile, setSelectedFile] =
    useState<SelectedGLB | null>(null);


  // ==================================================
  // UPLOAD STATE
  // ==================================================

  const [uploadStatus, setUploadStatus] =
    useState<UploadStatus>("idle");

  const [uploadMessage, setUploadMessage] =
    useState<string | null>(null);

  const [uploadedPath, setUploadedPath] =
    useState<string | null>(null);


  // ==================================================
  // HANDLE SELECTED FILE
  // ==================================================

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) {
        return;
      }

      if (!isGLBFile(file)) {
        setUploadStatus("error");

        setUploadMessage(
          "Only .glb files can be uploaded."
        );

        return;
      }

      const nextFile: SelectedGLB = {
        name: file.name,
        size: file.size,
        type:
          file.type ||
          "model/gltf-binary",
        file,
      };

      setSelectedFile(nextFile);

      setUploadStatus("idle");

      setUploadMessage(null);

      setUploadedPath(null);


      // Automatically create a name from the
      // filename if the name field is empty.

      if (!companionName.trim()) {
        const nameWithoutExtension =
          file.name.replace(
            /\.glb$/i,
            ""
          );

        setCompanionName(
          nameWithoutExtension
        );

        setCompanionKey(
          createCompanionKey(
            nameWithoutExtension
          )
        );
      }
    },
    [companionName]
  );


  // ==================================================
  // OPEN FILE PICKER
  // ==================================================

  function openFilePicker() {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Web Admin Tool",
        "The first version of the GLB uploader is designed for the web admin page. Open Mission Trail in your desktop browser to upload GLB files."
      );

      return;
    }

    fileInputRef.current?.click();
  }


  // ==================================================
  // FILE INPUT CHANGE
  // ==================================================

  function handleFileInputChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ??
      null;

    handleFile(file);

    // Allows selecting the same file again later.
    event.target.value = "";
  }


  // ==================================================
  // DRAG OVER
  // ==================================================

  function handleDragOver(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    event.stopPropagation();
  }


  // ==================================================
  // DROP FILE
  // ==================================================

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    event.stopPropagation();

    const file =
      event.dataTransfer.files?.[0] ??
      null;

    handleFile(file);
  }


  // ==================================================
  // NAME CHANGE
  // ==================================================

  function handleCompanionNameChange(
    value: string
  ) {
    const oldGeneratedKey =
      createCompanionKey(
        companionName
      );

    setCompanionName(value);


    // Automatically update the key while the user
    // has not manually customized it.

    if (
      !companionKey.trim() ||
      companionKey === oldGeneratedKey
    ) {
      setCompanionKey(
        createCompanionKey(value)
      );
    }
  }


  // ==================================================
  // REMOVE SELECTED FILE
  // ==================================================

  function removeSelectedFile() {
    if (uploadStatus === "uploading") {
      return;
    }

    setSelectedFile(null);

    setUploadedPath(null);

    setUploadMessage(null);

    setUploadStatus("idle");
  }


  // ==================================================
  // RESET FORM
  // ==================================================

  function resetForm() {
    setCompanionName("");

    setCompanionKey("");

    setDescription("");

    setRarity("common");

    setBaseHealth(
      String(DEFAULT_HEALTH)
    );

    setBaseEnergy(
      String(DEFAULT_ENERGY)
    );

    setSelectedFile(null);

    setUploadedPath(null);

    setUploadMessage(null);

    setUploadStatus("idle");
  }


  // ==================================================
  // VALIDATE FORM
  // ==================================================

  function validateForm() {
    if (!selectedFile) {
      return "Choose a GLB file first.";
    }

    if (!companionName.trim()) {
      return "Enter a companion name.";
    }

    if (!companionKey.trim()) {
      return "Enter a companion key.";
    }

    const health =
      Number(baseHealth);

    const energy =
      Number(baseEnergy);

    if (
      !Number.isFinite(health) ||
      health < 0
    ) {
      return "Base Health must be a valid number.";
    }

    if (
      !Number.isFinite(energy) ||
      energy < 0
    ) {
      return "Base Energy must be a valid number.";
    }

    return null;
  }


  // ==================================================
  // UPLOAD GLB
  // ==================================================

  async function uploadCompanion() {
    if (uploadStatus === "uploading") {
      return;
    }

    const validationError =
      validateForm();

    if (validationError) {
      setUploadStatus("error");

      setUploadMessage(
        validationError
      );

      return;
    }

    if (!selectedFile) {
      return;
    }


    // ================================================
    // START
    // ================================================

    setUploadStatus("uploading");

    setUploadMessage(
      "Uploading GLB..."
    );

    setUploadedPath(null);


    let storagePath:
      | string
      | null = null;


    try {

      // ==============================================
      // CHECK SESSION
      // ==============================================

      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();


      if (sessionError) {
        throw sessionError;
      }


      if (!sessionData.session?.user) {
        throw new Error(
          "You must be signed in before uploading a companion."
        );
      }


      // ==============================================
      // CLEAN COMPANION KEY
      // ==============================================

      const cleanKey =
        createCompanionKey(
          companionKey
        );


      if (!cleanKey) {
        throw new Error(
          "The companion key is invalid."
        );
      }


      // ==============================================
      // CHECK FOR DUPLICATE COMPANION KEY
      // ==============================================

      setUploadMessage(
        "Checking companion catalog..."
      );


      const {
        data: existingCompanion,
        error: existingError,
      } =
        await supabase
          .from("companions")
          .select(
            "id, companion_key, name"
          )
          .eq(
            "companion_key",
            cleanKey
          )
          .maybeSingle();


      if (existingError) {
        throw existingError;
      }


      if (existingCompanion) {
        throw new Error(
          `A companion already exists with the key "${cleanKey}".`
        );
      }


      // ==============================================
      // CREATE STORAGE PATH
      // ==============================================

      const cleanFileName =
        sanitizeFileName(
          selectedFile.name
        );


      storagePath =
        `${cleanKey}/${cleanFileName}`;


      // ==============================================
      // UPLOAD TO SUPABASE STORAGE
      // ==============================================

      setUploadMessage(
        "Uploading model to Supabase Storage..."
      );


      const {
        error: storageError,
      } =
        await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(
            storagePath,
            selectedFile.file,
            {
              cacheControl: "3600",

              upsert: false,

              contentType:
                selectedFile.type ||
                "model/gltf-binary",
            }
          );


      if (storageError) {
        throw storageError;
      }


      // ==============================================
      // CREATE COMPANION DATABASE RECORD
      // ==============================================

      setUploadMessage(
        "Creating companion database record..."
      );


      const health =
        Math.round(
          Number(baseHealth)
        );


      const energy =
        Math.round(
          Number(baseEnergy)
        );


      const {
        data: createdCompanion,
        error: databaseError,
      } =
        await supabase
          .from("companions")
          .insert({
            companion_key:
              cleanKey,

            name:
              companionName.trim(),

            description:
              description.trim() ||
              null,

            rarity:
              rarity.trim().toLowerCase(),

            model_path:
              storagePath,

            thumbnail_path:
              null,

            base_health:
              health,

            base_energy:
              energy,
          })
          .select(
            `
              id,
              companion_key,
              name,
              model_path
            `
          )
          .single();


      if (databaseError) {

        // ============================================
        // ROLLBACK STORAGE FILE
        // ============================================
        //
        // The GLB uploaded successfully but the
        // database insert failed.
        //
        // Remove the uploaded GLB so we do not leave
        // an orphaned Storage object.
        //
        // ============================================

        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([
            storagePath,
          ]);

        storagePath = null;

        throw databaseError;
      }


      // ==============================================
      // SUCCESS
      // ==============================================

      setUploadedPath(
        createdCompanion.model_path
      );

      setUploadStatus("success");

      setUploadMessage(
        `${createdCompanion.name} was added successfully.`
      );


      console.log(
        "[AdminLoadGLB] Companion created:",
        createdCompanion
      );

    } catch (error) {

      console.error(
        "[AdminLoadGLB] Upload failed:",
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : "The GLB could not be uploaded.";


      setUploadStatus("error");

      setUploadMessage(message);
    }
  }


  // ==================================================
  // RENDER
  // ==================================================

  return (
    <LinearGradient
      colors={[
        "#030007",
        "#090012",
        "#160326",
        "#05000B",
      ]}
      style={styles.screen}
    >
      <StatusBar style="light" />


      {/* ============================================
          HIDDEN WEB FILE INPUT
      ============================================ */}

      {Platform.OS === "web" ? (
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,model/gltf-binary"
          onChange={
            handleFileInputChange
          }
          style={{
            display: "none",
          }}
        />
      ) : null}


      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              safeArea.top + 30,

            paddingBottom:
              safeArea.bottom + 60,
          },
        ]}
      >

        {/* ==========================================
            HEADER
        ========================================== */}

        <View style={styles.header}>

          <View
            style={styles.headerIcon}
          >
            <Ionicons
              name="cube-outline"
              size={30}
              color="#D85CFF"
            />
          </View>


          <View style={styles.headerCopy}>

            <Text style={styles.eyebrow}>
              MISSION TRAIL ADMIN
            </Text>

            <Text style={styles.title}>
              Load Companion GLB
            </Text>

            <Text style={styles.subtitle}>
              Upload a 3D Companion model and
              register it in the Companion catalog.
            </Text>

          </View>

        </View>


        {/* ==========================================
            WARNING
        ========================================== */}

        <View style={styles.warningCard}>

          <Ionicons
            name="warning-outline"
            size={22}
            color="#FFC95C"
          />

          <Text style={styles.warningText}>
            Development admin page. This route is
            intentionally not linked in the normal
            Mission Trail interface. Authentication
            and administrator authorization should
            be hardened before production.
          </Text>

        </View>


        {/* ==========================================
            FILE DROP AREA
        ========================================== */}

        <View
          // React Native Web passes these through.
          {...(
            Platform.OS === "web"
              ? ({
                  onDragOver:
                    handleDragOver,

                  onDrop:
                    handleDrop,
                } as any)
              : {}
          )}
          style={styles.dropZone}
        >

          <View
            style={
              styles.dropIconCircle
            }
          >
            <Ionicons
              name="cloud-upload-outline"
              size={50}
              color="#D85CFF"
            />
          </View>


          <Text
            style={styles.dropTitle}
          >
            {selectedFile
              ? "GLB Selected"
              : "Drop GLB Here"}
          </Text>


          <Text
            style={styles.dropSubtitle}
          >
            {selectedFile
              ? selectedFile.name
              : Platform.OS === "web"
                ? "Drag and drop a .glb file here, or choose one from your computer."
                : "Choose a GLB using the desktop admin page."}
          </Text>


          {!selectedFile ? (
            <Pressable
              onPress={openFilePicker}
              style={({ pressed }) => [
                styles.selectButton,

                pressed
                  ? styles.buttonPressed
                  : undefined,
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={21}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.selectButtonText
                }
              >
                OPEN FILE
              </Text>
            </Pressable>
          ) : (
            <View
              style={
                styles.selectedFileCard
              }
            >

              <Ionicons
                name="cube"
                size={30}
                color="#52E7FF"
              />


              <View
                style={
                  styles.selectedFileCopy
                }
              >

                <Text
                  style={
                    styles.selectedFileName
                  }
                  numberOfLines={1}
                >
                  {selectedFile.name}
                </Text>

                <Text
                  style={
                    styles.selectedFileSize
                  }
                >
                  {formatFileSize(
                    selectedFile.size
                  )}
                </Text>

              </View>


              <Pressable
                disabled={
                  uploadStatus ===
                  "uploading"
                }
                onPress={
                  removeSelectedFile
                }
                style={
                  styles.removeFileButton
                }
              >
                <Ionicons
                  name="close"
                  size={23}
                  color="#FF6A9D"
                />
              </Pressable>

            </View>
          )}

        </View>


        {/* ==========================================
            COMPANION DETAILS
        ========================================== */}

        <View style={styles.formCard}>

          <View
            style={styles.sectionHeader}
          >

            <Ionicons
              name="paw-outline"
              size={22}
              color="#58E9FF"
            />

            <Text
              style={styles.sectionTitle}
            >
              Companion Information
            </Text>

          </View>


          {/* NAME */}

          <Text style={styles.label}>
            Companion Name
          </Text>

          <TextInput
            value={companionName}
            onChangeText={
              handleCompanionNameChange
            }
            placeholder="Example: Ember Dragon"
            placeholderTextColor="#675D70"
            style={styles.input}
          />


          {/* KEY */}

          <Text style={styles.label}>
            Companion Key
          </Text>

          <TextInput
            value={companionKey}
            onChangeText={
              setCompanionKey
            }
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ember-dragon"
            placeholderTextColor="#675D70"
            style={styles.input}
          />

          <Text style={styles.hint}>
            Unique internal ID used by Mission Trail.
          </Text>


          {/* DESCRIPTION */}

          <Text style={styles.label}>
            Description
          </Text>

          <TextInput
            value={description}
            onChangeText={
              setDescription
            }
            placeholder="Describe this companion..."
            placeholderTextColor="#675D70"
            multiline
            style={[
              styles.input,
              styles.textArea,
            ]}
          />


          {/* RARITY */}

          <Text style={styles.label}>
            Rarity
          </Text>

          <View
            style={styles.rarityRow}
          >
            {[
              "common",
              "uncommon",
              "rare",
              "epic",
              "legendary",
            ].map((item) => {

              const selected =
                rarity === item;

              return (
                <Pressable
                  key={item}
                  onPress={() =>
                    setRarity(item)
                  }
                  style={[
                    styles.rarityButton,

                    selected
                      ? styles.rarityButtonActive
                      : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.rarityText,

                      selected
                        ? styles.rarityTextActive
                        : undefined,
                    ]}
                  >
                    {item.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>


          {/* STATS */}

          <View style={styles.statRow}>

            <View
              style={styles.statField}
            >

              <Text style={styles.label}>
                Base Health
              </Text>

              <TextInput
                value={baseHealth}
                onChangeText={
                  setBaseHealth
                }
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor="#675D70"
                style={styles.input}
              />

            </View>


            <View
              style={styles.statField}
            >

              <Text style={styles.label}>
                Base Energy
              </Text>

              <TextInput
                value={baseEnergy}
                onChangeText={
                  setBaseEnergy
                }
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor="#675D70"
                style={styles.input}
              />

            </View>

          </View>

        </View>


        {/* ==========================================
            UPLOAD RESULT
        ========================================== */}

        {uploadMessage ? (
          <View
            style={[
              styles.messageCard,

              uploadStatus === "success"
                ? styles.successCard
                : undefined,

              uploadStatus === "error"
                ? styles.errorCard
                : undefined,
            ]}
          >

            {uploadStatus ===
            "uploading" ? (
              <ActivityIndicator
                size="small"
                color="#58E9FF"
              />
            ) : (
              <Ionicons
                name={
                  uploadStatus ===
                  "success"
                    ? "checkmark-circle"
                    : "information-circle"
                }
                size={22}
                color={
                  uploadStatus ===
                  "success"
                    ? "#5CFFA0"
                    : uploadStatus ===
                        "error"
                      ? "#FF668F"
                      : "#58E9FF"
                }
              />
            )}


            <View
              style={
                styles.messageCopy
              }
            >
              <Text
                style={
                  styles.messageText
                }
              >
                {uploadMessage}
              </Text>


              {uploadedPath ? (
                <Text
                  selectable
                  style={
                    styles.pathText
                  }
                >
                  {uploadedPath}
                </Text>
              ) : null}
            </View>

          </View>
        ) : null}


        {/* ==========================================
            UPLOAD BUTTON
        ========================================== */}

        <Pressable
          disabled={
            uploadStatus ===
            "uploading"
          }
          onPress={() =>
            void uploadCompanion()
          }
          style={({ pressed }) => [
            styles.uploadButton,

            uploadStatus ===
            "uploading"
              ? styles.uploadButtonDisabled
              : undefined,

            pressed
              ? styles.buttonPressed
              : undefined,
          ]}
        >

          <LinearGradient
            colors={[
              "#8B2BFF",
              "#D52FFF",
              "#25C9FF",
            ]}
            start={{
              x: 0,
              y: 0,
            }}
            end={{
              x: 1,
              y: 0,
            }}
            style={
              styles.uploadButtonGradient
            }
          >

            {uploadStatus ===
            "uploading" ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Ionicons
                name="cloud-upload"
                size={23}
                color="#FFFFFF"
              />
            )}


            <Text
              style={
                styles.uploadButtonText
              }
            >
              {uploadStatus ===
              "uploading"
                ? "UPLOADING..."
                : "UPLOAD COMPANION"}
            </Text>

          </LinearGradient>

        </Pressable>


        {/* RESET */}

        <Pressable
          disabled={
            uploadStatus ===
            "uploading"
          }
          onPress={resetForm}
          style={({ pressed }) => [
            styles.resetButton,

            pressed
              ? styles.buttonPressed
              : undefined,
          ]}
        >
          <Ionicons
            name="refresh-outline"
            size={19}
            color="#B8AFC2"
          />

          <Text
            style={
              styles.resetButtonText
            }
          >
            Clear Form
          </Text>
        </Pressable>


        {/* ==========================================
            STORAGE INFORMATION
        ========================================== */}

        <View style={styles.infoCard}>

          <Text
            style={styles.infoTitle}
          >
            Upload Destination
          </Text>

          <Text
            selectable
            style={styles.infoValue}
          >
            Supabase Storage / {STORAGE_BUCKET}
          </Text>

          <Text
            style={styles.infoDescription}
          >
            After the GLB uploads, this page creates
            its Companion catalog record and stores
            the Storage object path in
            companions.model_path.
          </Text>

        </View>

      </ScrollView>

    </LinearGradient>
  );
}


// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({

  screen: {
    flex: 1,
  },


  content: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 22,
  },


  // ==================================================
  // HEADER
  // ==================================================

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },


  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#170C24",
    borderWidth: 1,
    borderColor: "#67308A",
  },


  headerCopy: {
    flex: 1,
  },


  eyebrow: {
    color: "#B95CFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginBottom: 4,
  },


  title: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "900",
  },


  subtitle: {
    color: "#9D91A8",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },


  // ==================================================
  // WARNING
  // ==================================================

  warningCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#181008",
    borderWidth: 1,
    borderColor: "#5C461D",
    marginBottom: 22,
  },


  warningText: {
    flex: 1,
    color: "#D6C28F",
    fontSize: 13,
    lineHeight: 19,
  },


  // ==================================================
  // DROP ZONE
  // ==================================================

  dropZone: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#7538A4",
    backgroundColor: "#0C0613",
    marginBottom: 22,
  },


  dropIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#170C24",
    marginBottom: 18,
  },


  dropTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },


  dropSubtitle: {
    maxWidth: 500,
    color: "#8F849A",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },


  selectButton: {
    marginTop: 22,
    minHeight: 50,
    paddingHorizontal: 25,
    borderRadius: 14,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7027AE",
  },


  selectButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: 0.7,
  },


  selectedFileCard: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#120B1B",
    borderWidth: 1,
    borderColor: "#453052",
    marginTop: 22,
  },


  selectedFileCopy: {
    flex: 1,
  },


  selectedFileName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },


  selectedFileSize: {
    color: "#81778A",
    fontSize: 12,
    marginTop: 3,
  },


  removeFileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27101A",
  },


  // ==================================================
  // FORM
  // ==================================================

  formCard: {
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#0B0611",
    borderWidth: 1,
    borderColor: "#34223E",
    marginBottom: 22,
  },


  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },


  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },


  label: {
    color: "#CFC5D7",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 7,
  },


  input: {
    width: "100%",
    minHeight: 50,
    borderRadius: 13,
    paddingHorizontal: 15,
    color: "#FFFFFF",
    backgroundColor: "#120B19",
    borderWidth: 1,
    borderColor: "#3B2947",
    fontSize: 15,
  },


  textArea: {
    minHeight: 110,
    paddingTop: 14,
    textAlignVertical: "top",
  },


  hint: {
    color: "#756B7D",
    fontSize: 12,
    marginTop: 6,
  },


  rarityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },


  rarityButton: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: "#120B19",
    borderWidth: 1,
    borderColor: "#3B2947",
  },


  rarityButtonActive: {
    backgroundColor: "#54217A",
    borderColor: "#D04FFF",
  },


  rarityText: {
    color: "#8C8095",
    fontSize: 11,
    fontWeight: "900",
  },


  rarityTextActive: {
    color: "#FFFFFF",
  },


  statRow: {
    flexDirection: "row",
    gap: 14,
  },


  statField: {
    flex: 1,
  },


  // ==================================================
  // STATUS
  // ==================================================

  messageCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#294B56",
    backgroundColor: "#071317",
    marginBottom: 18,
  },


  successCard: {
    borderColor: "#27583B",
    backgroundColor: "#07150E",
  },


  errorCard: {
    borderColor: "#64263A",
    backgroundColor: "#19090F",
  },


  messageCopy: {
    flex: 1,
  },


  messageText: {
    color: "#E7E1EB",
    fontSize: 14,
    lineHeight: 20,
  },


  pathText: {
    color: "#70E9FF",
    fontSize: 12,
    marginTop: 7,
  },


  // ==================================================
  // BUTTONS
  // ==================================================

  uploadButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },


  uploadButtonDisabled: {
    opacity: 0.6,
  },


  uploadButtonGradient: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },


  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },


  resetButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 10,
    marginBottom: 22,
  },


  resetButtonText: {
    color: "#B8AFC2",
    fontWeight: "700",
  },


  buttonPressed: {
    opacity: 0.72,
  },


  // ==================================================
  // INFO
  // ==================================================

  infoCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#09060D",
    borderWidth: 1,
    borderColor: "#29202F",
  },


  infoTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },


  infoValue: {
    color: "#58E9FF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },


  infoDescription: {
    color: "#83798B",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

});