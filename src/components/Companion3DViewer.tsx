// src/components/Companion3DViewer.tsx

import React, { Suspense, useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Canvas } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { LoopRepeat } from "three";


// ====================================================
// TYPES
// ====================================================

type Companion3DViewerProps = {
  // Local GLB path or full Supabase Storage URL.
  model?: string | null;

  // Animation speed:
  // 0.5 = half speed
  // 1   = normal speed
  // 2   = twice as fast
  animationSpeed?: number;

  // Model size.
  scale?: number;

  // X, Y, Z position.
  position?: [number, number, number];

  // X, Y, Z rotation.
  rotation?: [number, number, number];
};


// ====================================================
// FALLBACK MODEL
// ====================================================
//
// This model is used only when no model is passed
// into the component.
//
// This keeps older Companion3DViewer usages working
// while Mission Trail is moved to database-controlled
// Companion models.
//
// ====================================================

const FALLBACK_MODEL_PATH =
  "/glbModels/Draggon.glb";


// ====================================================
// ⭐⭐⭐ DEFAULT ANIMATION SPEED ⭐⭐⭐
// ====================================================
//
// 0.5 = half speed
// 1   = normal speed
// 2   = twice as fast
//
// ====================================================

const DEFAULT_ANIMATION_SPEED = 1;


// ====================================================
// ⭐⭐⭐ DEFAULT MODEL SIZE ⭐⭐⭐
// ====================================================
//
// 1   = original size
// 1.5 = 50% bigger
// 2   = twice as big
//
// ====================================================

const DEFAULT_MODEL_SCALE = 1.5;


// ====================================================
// ⭐⭐⭐ DEFAULT MODEL POSITION ⭐⭐⭐
// ====================================================
//
// X = left / right
// Y = up / down
// Z = forward / backward
//
// ====================================================

const DEFAULT_MODEL_POSITION: [
  number,
  number,
  number
] = [
  0,
  0,
  0,
];


// ====================================================
// ⭐⭐⭐ DEFAULT MODEL ROTATION ⭐⭐⭐
// ====================================================
//
// Values are in radians.
//
// ====================================================

const DEFAULT_MODEL_ROTATION: [
  number,
  number,
  number
] = [
  0,
  0,
  0,
];


// ====================================================
// ⭐⭐⭐ CAMERA CONTROL ⭐⭐⭐
// ====================================================
//
// CAMERA_Z:
//
// Smaller number = camera closer
// Larger number  = camera farther away
//
// ====================================================

const CAMERA_X = 0;
const CAMERA_Y = 0;
const CAMERA_Z = 5;

const CAMERA_FOV = 45;


// ====================================================
// GLB MODEL
// ====================================================

function GLBModel({
  model,
  animationSpeed,
  scale,
  position,
  rotation,
}: {
  model: string;
  animationSpeed: number;
  scale: number;
  position: [number, number, number];
  rotation: [number, number, number];
}) {

  // ==================================================
  // LOAD MODEL
  // ==================================================
  //
  // "model" can now be either:
  //
  // /glbModels/Draggon.glb
  //
  // OR:
  //
  // https://xxxxx.supabase.co/storage/v1/object/public/
  // companion-models/Draggon.glb
  //
  // ==================================================

  const gltf = useGLTF(model);


  // ==================================================
  // LOAD ANIMATIONS FROM GLB
  // ==================================================

  const {
    actions,
    names,
  } = useAnimations(
    gltf.animations,
    gltf.scene
  );


  // ==================================================
  // PLAY ANIMATION
  // ==================================================

  useEffect(() => {

    // Use the first animation contained in the GLB.
    const animationName = names[0];


    // ================================================
    // NO ANIMATION FOUND
    // ================================================

    if (!animationName) {

      console.warn(
        "[Companion3DViewer] No animation found in GLB:",
        model
      );

      return;
    }


    // ================================================
    // GET ANIMATION
    // ================================================

    const action =
      actions[animationName];


    if (!action) {

      console.warn(
        "[Companion3DViewer] Animation action could not be created:",
        animationName
      );

      return;
    }


    console.log(
      "[Companion3DViewer] Loaded model:",
      model
    );


    console.log(
      "[Companion3DViewer] Playing animation:",
      animationName
    );


    console.log(
      "[Companion3DViewer] Animation speed:",
      animationSpeed
    );


    // ================================================
    // RESET ANIMATION
    // ================================================

    action.reset();


    // ================================================
    // SET ANIMATION SPEED
    // ================================================

    action.setEffectiveTimeScale(
      animationSpeed
    );


    // ================================================
    // LOOP ANIMATION FOREVER
    // ================================================

    action.setLoop(
      LoopRepeat,
      Infinity
    );


    // ================================================
    // START ANIMATION
    // ================================================

    action.play();


    // ================================================
    // CLEANUP
    // ================================================

    return () => {

      action.stop();

    };

  }, [
    actions,
    names,
    animationSpeed,
    model,
  ]);


  // ==================================================
  // RENDER MODEL
  // ==================================================

  return (

    <primitive
      object={gltf.scene}

      scale={scale}

      position={position}

      rotation={rotation}
    />

  );
}


// ====================================================
// COMPANION 3D VIEWER
// ====================================================

export default function Companion3DViewer({
  model,
  animationSpeed = DEFAULT_ANIMATION_SPEED,
  scale = DEFAULT_MODEL_SCALE,
  position = DEFAULT_MODEL_POSITION,
  rotation = DEFAULT_MODEL_ROTATION,
}: Companion3DViewerProps) {

  // ==================================================
  // DETERMINE WHICH MODEL TO LOAD
  // ==================================================
  //
  // If companion.tsx supplies a model URL, use it.
  //
  // Otherwise fall back to the existing local dragon.
  //
  // ==================================================

  const resolvedModel =
    typeof model === "string" &&
    model.trim().length > 0
      ? model.trim()
      : FALLBACK_MODEL_PATH;


  // ==================================================
  // RENDER
  // ==================================================

  return (

    <View style={styles.container}>

      <Canvas

        camera={{
          position: [
            CAMERA_X,
            CAMERA_Y,
            CAMERA_Z,
          ],

          fov: CAMERA_FOV,
        }}

        gl={{
          alpha: true,
        }}

      >

        {/* ==========================================
            LIGHTING
        ========================================== */}

        <ambientLight
          intensity={1.5}
        />


        <directionalLight
          position={[
            5,
            5,
            5,
          ]}
          intensity={2}
        />


        <directionalLight
          position={[
            -5,
            3,
            2,
          ]}
          intensity={1}
        />


        {/* ==========================================
            COMPANION
        ========================================== */}

        <Suspense fallback={null}>

          <GLBModel
            model={resolvedModel}
            animationSpeed={animationSpeed}
            scale={scale}
            position={position}
            rotation={rotation}
          />

        </Suspense>

      </Canvas>

    </View>

  );
}


// ====================================================
// PRELOAD FALLBACK MODEL
// ====================================================
//
// Only preload the known local model.
//
// Database/Supabase models cannot be preloaded here
// because their URLs are determined dynamically
// based on which Companion the player selected.
//
// ====================================================

useGLTF.preload(
  FALLBACK_MODEL_PATH
);


// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({

  container: {

    width: "100%",

    height: "100%",

    minHeight: 200,

    position: "relative",

    backgroundColor: "transparent",

  },

});