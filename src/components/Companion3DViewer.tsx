// src/components/Companion3DViewer.tsx

import React, { Suspense, useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Canvas } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";

// ====================================================
// MODEL
// ====================================================

const MODEL_PATH = "/glbModels/test.glb";


// ====================================================
// ⭐⭐⭐ ANIMATION SPEED CONTROL ⭐⭐⭐
// ====================================================
//
// THIS IS THE NUMBER YOU CHANGE.
//
// 1   = original GLB speed
// 2   = 2x faster
// 5   = 5x faster
// 10  = 10x faster
// 20  = 20x faster
// 100 = 100x faster
//
// ====================================================

const ANIMATION_SPEED = 1;


// ====================================================
// MODEL SIZE / POSITION
// ====================================================
//
// Leave these alone for now.
// We'll adjust these after the animation speed is right.
//
// ====================================================

const MODEL_SCALE = 1;

const MODEL_POSITION: [number, number, number] = [
  0,
  0,
  0,
];

const MODEL_ROTATION: [number, number, number] = [
  0,
  0,
  0,
];


// ====================================================
// GLB MODEL
// ====================================================

function GLBModel() {
  const gltf = useGLTF(MODEL_PATH);

  // Connect the animation stored inside the GLB
  // to the model's scene.
  const { actions, names } = useAnimations(
    gltf.animations,
    gltf.scene
  );

  useEffect(() => {
    // There is only one animation in this GLB,
    // so grab the first animation.
    const animationName = names[0];

    if (!animationName) {
      console.warn(
        "[Companion3DViewer] No animation found in GLB."
      );
      return;
    }

    const action = actions[animationName];

    if (!action) {
      console.warn(
        "[Companion3DViewer] Animation action could not be created:",
        animationName
      );
      return;
    }

    console.log(
      "[Companion3DViewer] Playing animation:",
      animationName
    );

    console.log(
      "[Companion3DViewer] Animation speed:",
      ANIMATION_SPEED
    );


    // ==================================================
    // ⭐⭐⭐ THIS ACTUALLY APPLIES THE SPEED ⭐⭐⭐
    // ==================================================

    action.reset();

    action.setEffectiveTimeScale(ANIMATION_SPEED);

    action.play();


    // Stop the animation if the model gets removed.
    return () => {
      action.stop();
    };

  }, [actions, names]);


  // ==================================================
  // RENDER MODEL
  // ==================================================

  return (
    <primitive
      object={gltf.scene}
      scale={MODEL_SCALE}
      position={MODEL_POSITION}
      rotation={MODEL_ROTATION}
    />
  );
}


// ====================================================
// COMPANION 3D VIEWER
// ====================================================

export default function Companion3DViewer() {
  return (
    <View style={styles.container}>

      <Canvas
        camera={{
          position: [0, 0, 5],
          fov: 45,
        }}

        gl={{
          alpha: true,
        }}
      >

        {/* Transparent Canvas.
            The app background shows through. */}


        {/* ==========================================
            LIGHTING
            ========================================== */}

        <ambientLight intensity={1.5} />

        <directionalLight
          position={[5, 5, 5]}
          intensity={2}
        />

        <directionalLight
          position={[-5, 3, 2]}
          intensity={1}
        />


        {/* ==========================================
            MODEL
            ========================================== */}

        <Suspense fallback={null}>
          <GLBModel />
        </Suspense>

      </Canvas>

    </View>
  );
}


// ====================================================
// PRELOAD MODEL
// ====================================================

useGLTF.preload(MODEL_PATH);


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