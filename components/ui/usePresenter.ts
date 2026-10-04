"use client";

import { useEffect, useState } from "react";

const KEY = "tacit.presenter";

/** Presenter mode is per tab. It never rides on the ERP frame URL. */
export function usePresenter(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("presenter");
    if (q === "0") sessionStorage.removeItem(KEY);
    else if (q === "1") sessionStorage.setItem(KEY, "1");
    setOn(sessionStorage.getItem(KEY) === "1");
  }, []);
  return on;
}
