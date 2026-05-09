(function () {
  const Core = window.KlevbyFeedSupabaseCore || {};

  let klevbyFeedRealtimeChannel = null;

  function subscribeToFeedChanges(callback) {
    const db = Core.getClient();

    if (!db || typeof db.channel !== "function") {
      return null;
    }

    Core.setRealtimeCallback(typeof callback === "function" ? callback : null);

    if (klevbyFeedRealtimeChannel) {
      return klevbyFeedRealtimeChannel;
    }

    try {
      klevbyFeedRealtimeChannel = db
        .channel("klevby-feed-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: Core.TABLE
          },
          (payload) => {
            Core.dispatch("feed_post_changed", {
              payload,
              postId: payload?.new?.id || payload?.old?.id || ""
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: Core.LIKES_TABLE
          },
          (payload) => {
            Core.dispatch("feed_like_changed", {
              payload,
              postId: payload?.new?.post_id || payload?.old?.post_id || ""
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: Core.COMMENTS_TABLE
          },
          (payload) => {
            Core.dispatch("feed_comment_changed", {
              payload,
              postId: payload?.new?.post_id || payload?.old?.post_id || ""
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: Core.VIEWS_TABLE
          },
          (payload) => {
            Core.dispatch("feed_view_changed", {
              payload,
              postId: payload?.new?.post_id || payload?.old?.post_id || ""
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Klevby feed: realtime подключён");
          }

          if (status === "CHANNEL_ERROR") {
            console.warn("Klevby feed: realtime канал вернул ошибку");
          }
        });

      return klevbyFeedRealtimeChannel;
    } catch (error) {
      console.warn("Klevby feed: realtime не подключился", error);
      klevbyFeedRealtimeChannel = null;
      return null;
    }
  }

  async function unsubscribeFromFeedChanges() {
    const db = Core.getClient();

    if (!db || !klevbyFeedRealtimeChannel) {
      klevbyFeedRealtimeChannel = null;
      Core.setRealtimeCallback(null);
      return;
    }

    try {
      await db.removeChannel(klevbyFeedRealtimeChannel);
    } catch (error) {
      console.warn("Klevby feed: не удалось отключить realtime", error);
    }

    klevbyFeedRealtimeChannel = null;
    Core.setRealtimeCallback(null);
  }

  window.KlevbyFeedSupabaseRealtime = {
    subscribeToFeedChanges,
    unsubscribeFromFeedChanges
  };
})();
