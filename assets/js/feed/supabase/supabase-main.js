(function () {
  const Posts = window.KlevbyFeedSupabasePosts || {};
  const Likes = window.KlevbyFeedSupabaseLikes || {};
  const Comments = window.KlevbyFeedSupabaseComments || {};
  const Realtime = window.KlevbyFeedSupabaseRealtime || {};

  const api = {
    loadPosts: Posts.loadFeedPostsFromSupabase,
    createPhotoPost: Posts.createFeedPhotoPost,
    deletePost: Posts.deleteFeedPostFromSupabase,
    toggleLike: Likes.toggleFeedLike,
    loadComments: Comments.loadFeedComments,
    addComment: Comments.addFeedComment,
    deleteComment: Comments.deleteFeedComment,
    registerView: Comments.registerFeedView,
    subscribeToFeedChanges: Realtime.subscribeToFeedChanges,
    subscribeToChanges: Realtime.subscribeToFeedChanges,
    subscribe: Realtime.subscribeToFeedChanges,
    unsubscribe: Realtime.unsubscribeFromFeedChanges
  };

  window.KlevbyFeedSupabaseMain = api;
})();
