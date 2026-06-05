const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPostsState() {
  const source = fs.readFileSync(
    path.join(__dirname, "../assets/js/posts/posts-state.js"),
    "utf8"
  );
  const window = {};
  const context = vm.createContext({
    window,
    console,
    Date,
    setTimeout,
    clearTimeout
  });

  vm.runInContext(source, context, { filename: "posts-state.js" });

  return window.KlevbyPostsState;
}

const state = loadPostsState();
const todayIso = "2026-06-05";

test("getTripLifecycle classifies past, today, future, and undated trips", () => {
  assert.equal(state.getTripLifecycle({ trip_date: "2026-06-04" }, todayIso), "expired");
  assert.equal(state.getTripLifecycle({ trip_date: todayIso }, todayIso), "active");
  assert.equal(state.getTripLifecycle({ trip_date: "2026-06-06" }, todayIso), "active");
  assert.equal(state.getTripLifecycle({ trip_date: "" }, todayIso), "undated");
  assert.equal(state.getTripLifecycle({ trip_date: "2026-02-30" }, todayIso), "undated");
});

test("partitionTrips creates owner-aware lifecycle buckets", () => {
  const mine = "owner-1";
  const posts = [
    { id: "mine-expired", owner_id: mine, trip_date: "2026-06-04" },
    { id: "other-expired", owner_id: "owner-2", trip_date: "2026-06-03" },
    { id: "mine-today", owner_id: mine, trip_date: todayIso },
    { id: "other-future", owner_id: "owner-2", trip_date: "2026-06-06" },
    { id: "mine-undated", owner_id: mine, trip_date: null },
    { id: "other-invalid", owner_id: "owner-2", trip_date: "not-a-date" }
  ];

  const result = state.partitionTrips(posts, { ownerId: mine, todayIso });

  assert.deepEqual(Array.from(result.activeAll, (post) => post.id), ["mine-today", "other-future"]);
  assert.deepEqual(Array.from(result.expiredAll, (post) => post.id), ["mine-expired", "other-expired"]);
  assert.deepEqual(Array.from(result.undatedAll, (post) => post.id), ["mine-undated", "other-invalid"]);
  assert.deepEqual(Array.from(result.activeMine, (post) => post.id), ["mine-today"]);
  assert.deepEqual(Array.from(result.expiredMine, (post) => post.id), ["mine-expired"]);
  assert.deepEqual(Array.from(result.undatedMine, (post) => post.id), ["mine-undated"]);
  assert.equal(result.expiredMine.length, 1, "foreign expired trips must not affect mine count");
});

test("partition membership does not depend on input order", () => {
  const posts = [
    { id: "expired", owner_id: "owner-1", trip_date: "2026-06-04" },
    { id: "active", owner_id: "owner-1", trip_date: "2026-06-06" },
    { id: "undated", owner_id: "owner-1", trip_date: "invalid" }
  ];

  function canonicalize(partitions) {
    return Object.fromEntries(
      Object.entries(partitions).map(([key, bucket]) => [
        key,
        Array.from(bucket, (post) => post.id).sort()
      ])
    );
  }

  const forward = state.partitionTrips(posts, { ownerId: "owner-1", todayIso });
  const reversed = state.partitionTrips([...posts].reverse(), { ownerId: "owner-1", todayIso });

  assert.deepEqual(canonicalize(forward), canonicalize(reversed));
});

test("mine trips mode defaults to active and only accepts expired", () => {
  assert.equal(state.getMineTripsMode(), "active");
  assert.equal(state.setMineTripsMode("expired"), "expired");
  assert.equal(state.getMineTripsMode(), "expired");
  assert.equal(state.setMineTripsMode("unexpected"), "active");
  assert.equal(state.getMineTripsMode(), "active");
});
