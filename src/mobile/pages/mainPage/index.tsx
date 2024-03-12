import React, { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@ant-design/react-native";
import tw from 'twrnc';

export default () => {
  const dispatch = useDispatch();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.mainPage}>
      <View style={tw`bg-red-500 h-50`}>
        <Button>click me</Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainPage: {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },
});
