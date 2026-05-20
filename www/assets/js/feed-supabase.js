(function () {
  const mainApi = window.KlevbyFeedSupabaseMain || null;

  function missingMethod(name) {
    return async function () {
      throw new Error(`Klevby feed Supabase module is not ready: ${name}`);
    };
  }

  const api = {
    loadPosts: mainApi?.loadPosts || missingMethod("loadPosts"),
    createPhotoPost: mainApi?.createPhotoPost || missingMethod("createPhotoPost"),
    deletePost: mainApi?.deletePost || missingMethod("deletePost"),
    toggleLike: mainApi?.toggleLike || missingMethod("toggleLike"),
    loadComments: mainApi?.loadComments || missingMethod("loadComments"),
    addComment: mainApi?.addComment || missingMethod("addComment"),
    deleteComment: mainApi?.deleteComment || missingMethod("deleteComment"),
    registerView: mainApi?.registerView || missingMethod("registerView"),
    subscribeToFeedChanges: mainApi?.subscribeToFeedChanges || function () {
      return null;
    },
    subscribeToChanges: mainApi?.subscribeToChanges || mainApi?.subscribeToFeedChanges || function () {
      return null;
    },
    subscribe: mainApi?.subscribe || mainApi?.subscribeToFeedChanges || function () {
      return null;
    },
    unsubscribe: mainApi?.unsubscribe || async function () {}
  };

  window.klevbyFeedSupabase = api;

  window.klevbyLoadFeedPostsFromSupabase = api.loadPosts;
  window.klevbyCreateFeedPhotoPost = api.createPhotoPost;
  window.klevbyDeleteFeedPostFromSupabase = api.deletePost;
  window.klevbyToggleFeedLike = api.toggleLike;
  window.klevbyLoadFeedComments = api.loadComments;
  window.klevbyAddFeedComment = api.addComment;
  window.klevbyDeleteFeedComment = api.deleteComment;
  window.klevbyRegisterFeedView = api.registerView;
  window.klevbySubscribeToFeedChanges = api.subscribeToFeedChanges;
  window.klevbyUnsubscribeFromFeedChanges = api.unsubscribe;

  console.log("Klevby feed supabase bridge loaded");
})();
