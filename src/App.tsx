import { useEffect } from 'react';
import './App.css';

declare global {
  interface Window {
    nostr?: any;
  }
}

import type { MediaList } from './types';
import { DEFAULT_RELAYS } from './constants';
import {
  renderListTitle,
  renderDirectorCreator
} from './utils';
import {
  DeleteListModal,
  EditListModal,
  NewListModal,
  FollowModal,
  SettingsModal,
  DetailsModal,
  LogWatchedModal,
  AuthorProfileModal,
  ConnectionModal,
  OnboardingModal,
  SearchModal
} from './components/modals';
import {
  FloatingAddButton
} from './components/common';
import {
  HubView,
  WorkspaceView
} from './views';
import {
  useMediaSearch,
  useNostrAuth,
  useSocialExplore,
  useMediaLists
} from './hooks';

function App() {
  // 1. Core Hooks
  const auth = useNostrAuth({
    onLogout: () => {
      lists.resetListsOnLogout();
      social.resetSocialState();
    }
  });

  const social = useSocialExplore({
    nostrUser: auth.nostrUser,
    nostrServiceRef: auth.nostrServiceRef,
    activeSignerRef: auth.activeSignerRef
  });

  const lists = useMediaLists({
    nostrUser: auth.nostrUser,
    nostrServiceRef: auth.nostrServiceRef,
    activeSignerRef: auth.activeSignerRef,
    setIsSyncing: auth.setIsSyncing,
    onSyncProfile: (meta) => {
      auth.setNostrUser(prev => prev ? {
        ...prev,
        name: meta.name || prev.name,
        picture: meta.picture || prev.picture
      } : null);
    },
    onSyncFollows: (remoteFollows) => {
      if (!auth.nostrUser?.pubkey) return;
      social.setFollowedPubkeys(remoteFollows);
      localStorage.setItem('watchlistr_followed_pubkeys', JSON.stringify(remoteFollows));
      social.loadFollowedData(remoteFollows);
    },
    onSyncBlocks: (remoteBlocks) => {
      if (!auth.nostrUser?.pubkey) return;
      social.setBlockedPubkeys(remoteBlocks);
      localStorage.setItem('watchlistr_blocked_pubkeys', JSON.stringify(remoteBlocks));
    }
  });

  const search = useMediaSearch();

  // Re-sync user lists and profile when pubkey / signer updates
  useEffect(() => {
    if (auth.nostrUser?.pubkey) {
      lists.syncFromNostr(auth.nostrUser.pubkey);
    }
  }, [auth.nostrUser?.pubkey, auth.nostrUser?.signerType]);

  // Clean logout handler
  const handleLogout = () => {
    auth.logoutNostr();
    lists.resetListsOnLogout();
    social.resetSocialState();
  };

  // Resolve currently viewed list and social profile context
  const isSocialList = lists.selectedListId ? lists.selectedListId.startsWith('social:') : false;
  let currentList: MediaList | undefined;
  let socialProfile: { name?: string; picture?: string; pubkey?: string } | undefined;

  if (isSocialList && lists.selectedListId) {
    const parts = lists.selectedListId.split(':');
    const pubkey = parts[1];
    const userLists = social.followedListsMap[pubkey] || social.exploreLists.filter(l => l.id.startsWith(`social:${pubkey}:`));
    currentList = userLists.find(x => x.id === lists.selectedListId) || social.exploreLists.find(x => x.id === lists.selectedListId);
    const profile = social.followedProfiles[pubkey] || social.exploreProfiles[pubkey];
    socialProfile = {
      pubkey,
      name: profile?.name || `${pubkey.substring(0, 8)}...`,
      picture: profile?.picture
    };
  } else {
    currentList = lists.lists.find(x => x.id === lists.selectedListId);
  }

  return (
    <div className="app-container">
      {!lists.selectedListId ? (
        /* PAGE 1: DASHBOARD HUB */
        <HubView
          nostrUser={auth.nostrUser}
          isSyncing={auth.isSyncing}
          onOpenSettings={() => auth.setIsSettingsModalOpen(true)}
          onOpenConnection={() => auth.setIsConnectionModalOpen(true)}
          onOpenLogin={() => {
            auth.setOnboardingStep(0);
            auth.setIsOnboardingOpen(true);
          }}
          activeHubTab={social.activeHubTab}
          setActiveHubTab={social.setActiveHubTab}
          lists={lists.lists}
          onOpenNewListModal={() => lists.setNewListModal({ isOpen: true, type: 'watched' })}
          onSyncFromNostr={lists.syncFromNostr}
          exploreLists={social.exploreLists}
          exploreProfiles={social.exploreProfiles}
          isExploreLoading={social.isExploreLoading}
          isExploreLoadingMore={social.isExploreLoadingMore}
          hasMoreExplore={social.hasMoreExplore}
          exploreObserverRef={social.exploreObserverRef}
          onRefreshExplore={social.loadExploreData}
          blockedPubkeys={social.blockedPubkeys}
          followedPubkeys={social.followedPubkeys}
          followedProfiles={social.followedProfiles}
          followedListsMap={social.followedListsMap}
          expandedFollowingUsers={social.expandedFollowingUsers}
          onToggleFollowedUserExpand={social.toggleFollowedUserExpand}
          onOpenFollowModal={() => social.setIsFollowModalOpen(true)}
          onUnfollowUser={social.handleUnfollowUser}
          onOpenWatchlist={lists.openWatchlist}
          onOpenAuthorProfile={(pubkey) => social.setAuthorProfileModal({ isOpen: true, pubkey })}
          relayStatuses={auth.relayStatuses}
        />
      ) : (
        /* PAGE 2: SINGLE LIST WORKSPACE */
        <WorkspaceView
          nostrUser={auth.nostrUser}
          isSyncing={auth.isSyncing}
          onOpenSettings={() => auth.setIsSettingsModalOpen(true)}
          onOpenConnection={() => auth.setIsConnectionModalOpen(true)}
          onOpenLogin={() => {
            auth.setOnboardingStep(0);
            auth.setIsOnboardingOpen(true);
          }}
          currentList={currentList}
          isSocialList={isSocialList}
          socialProfile={socialProfile}
          onCloseWatchlist={lists.closeWatchlist}
          onOpenEditListModal={lists.openEditListModal}
          onConfirmDeleteList={lists.confirmDeleteList}
          onOpenSearchDrawer={() => search.setIsSearchDrawerOpen(true)}
          onOpenAuthorProfile={(pubkey) => social.setAuthorProfileModal({ isOpen: true, pubkey })}
          onOpenDetailsModal={search.openDetailsModal}
          onOpenLogWatchedModal={lists.openLogWatchedModal}
          onRemoveFromWatchlist={lists.removeFromWatchlist}
          onRemoveFromWatched={lists.removeFromWatched}
          renderWatchlistRibbon={lists.renderWatchlistRibbon}
        />
      )}

      {/* Global Search Modal Popup (Find & Add) */}
      <SearchModal
        isOpen={search.isSearchDrawerOpen}
        onClose={() => search.setIsSearchDrawerOpen(false)}
        searchQuery={search.searchQuery}
        setSearchQuery={search.setSearchQuery}
        clearSearch={search.clearSearch}
        isLoading={search.isLoading}
        error={search.error}
        searchResults={search.searchResults}
        currentList={currentList}
        isInDefaultWatched={lists.isInDefaultWatched}
        openDetailsModal={search.openDetailsModal}
        renderDirectorCreator={renderDirectorCreator}
        renderWatchlistRibbon={lists.renderWatchlistRibbon}
        renderListTitle={renderListTitle}
        addToWatchlist={lists.addToWatchlist}
        openLogWatchedModal={lists.openLogWatchedModal}
      />

      {/* Floating Red Action Button for Find & Add */}
      <FloatingAddButton
        isVisible={!search.isSearchDrawerOpen}
        onClick={() => search.setIsSearchDrawerOpen(true)}
      />

      {/* Log Watched Modal */}
      <LogWatchedModal
        modal={lists.logModal}
        setModal={lists.setLogModal}
        onClose={() => lists.setLogModal(prev => ({ ...prev, isOpen: false, item: null }))}
        onSave={lists.saveWatchedDetails}
        onSetToday={lists.setTodayDate}
      />

      {/* Create New List Modal */}
      <NewListModal
        isOpen={lists.newListModal.isOpen}
        type={lists.newListModal.type}
        setType={(type) => lists.setNewListModal(prev => ({ ...prev, type }))}
        formData={lists.newListForm}
        setFormData={lists.setNewListForm}
        onClose={() => lists.setNewListModal({ isOpen: false, type: 'watched' })}
        onCreate={lists.createNewList}
      />

      {/* Edit List Modal */}
      <EditListModal
        isOpen={lists.editListModal.isOpen}
        list={lists.editListModal.list}
        formData={lists.editListForm}
        setFormData={lists.setEditListForm}
        onClose={() => lists.setEditListModal({ isOpen: false, list: null })}
        onSave={lists.saveEditList}
      />

      {/* Details Modal */}
      <DetailsModal
        modal={search.detailsModal}
        onClose={search.closeDetailsModal}
        watchedList={lists.watchedList}
        onRetry={(item) => search.openDetailsModal(item)}
        onMarkWatched={(item) => lists.openLogWatchedModal(item, 'search')}
        renderWatchlistRibbon={lists.renderWatchlistRibbon}
      />

      {/* Delete List Modal */}
      <DeleteListModal
        isOpen={lists.deleteListModal.isOpen}
        list={lists.deleteListModal.list}
        onClose={() => lists.setDeleteListModal({ isOpen: false, list: null })}
        onConfirm={lists.executeDeleteList}
      />

      {/* Follow Contact Modal */}
      <FollowModal
        isOpen={social.isFollowModalOpen}
        inputKey={social.followInputKey}
        setInputKey={social.setFollowInputKey}
        error={social.followError}
        onClose={() => social.setIsFollowModalOpen(false)}
        onFollow={social.handleFollowUser}
      />

      {/* Author Profile Modal */}
      <AuthorProfileModal
        isOpen={social.authorProfileModal.isOpen}
        pubkey={social.authorProfileModal.pubkey}
        onClose={() => social.setAuthorProfileModal({ isOpen: false, pubkey: null })}
        followedProfiles={social.followedProfiles}
        exploreProfiles={social.exploreProfiles}
        followedPubkeys={social.followedPubkeys}
        nostrUser={auth.nostrUser}
        followedListsMap={social.followedListsMap}
        exploreLists={social.exploreLists}
        blockedPubkeys={social.blockedPubkeys}
        onFollowUser={social.handleFollowUser}
        onUnfollowUser={social.handleUnfollowUser}
        onBlockUser={social.handleBlockUser}
        onUnblockUser={social.handleUnblockUser}
        onOpenWatchlist={lists.openWatchlist}
      />

      {/* Account & Profile Connection Modal */}
      <ConnectionModal
        isOpen={auth.isConnectionModalOpen}
        onClose={() => auth.setIsConnectionModalOpen(false)}
        nostrUser={auth.nostrUser}
        profileEditName={auth.profileEditName}
        setProfileEditName={auth.setProfileEditName}
        profileEditPicture={auth.profileEditPicture}
        setProfileEditPicture={auth.setProfileEditPicture}
        selectedImageFile={auth.selectedImageFile}
        setSelectedImageFile={auth.setSelectedImageFile}
        cropZoom={auth.cropZoom}
        setCropZoom={auth.setCropZoom}
        cropOffset={auth.cropOffset}
        setCropOffset={auth.setCropOffset}
        isDraggingPhoto={auth.isDraggingPhoto}
        setIsDraggingPhoto={auth.setIsDraggingPhoto}
        dragStartRef={auth.dragStartRef}
        isDraggingAvatar={auth.isDraggingAvatar}
        setIsDraggingAvatar={auth.setIsDraggingAvatar}
        isPublishingProfile={auth.isPublishingProfile}
        publishingStep={auth.publishingStep}
        profileStatus={auth.profileStatus}
        setProfileStatus={auth.setProfileStatus}
        handleFileSelection={auth.handleFileSelection}
        handlePublishProfile={auth.handlePublishProfile}
        logoutNostr={handleLogout}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={auth.isSettingsModalOpen}
        onClose={() => auth.setIsSettingsModalOpen(false)}
        relays={DEFAULT_RELAYS}
        relayStatuses={auth.relayStatuses}
        blockedPubkeys={auth.nostrUser ? social.blockedPubkeys : []}
        profiles={{ ...social.followedProfiles, ...social.exploreProfiles }}
        onUnblockUser={social.handleUnblockUser}
      />

      {/* Guided Onboarding & Direct Login Modal */}
      <OnboardingModal
        isOpen={auth.isOnboardingOpen}
        onClose={() => auth.setIsOnboardingOpen(false)}
        onboardingStep={auth.onboardingStep}
        setOnboardingStep={auth.setOnboardingStep}
        onboardingDesktopDevice={auth.onboardingDesktopDevice}
        setOnboardingDesktopDevice={auth.setOnboardingDesktopDevice}
        directAuthTab={auth.directAuthTab}
        setDirectAuthTab={auth.setDirectAuthTab}
        bunkerConnectMode={auth.bunkerConnectMode}
        setBunkerConnectMode={auth.setBunkerConnectMode}
        bunkerInputUrl={auth.bunkerInputUrl}
        setBunkerInputUrl={auth.setBunkerInputUrl}
        bunkerConnecting={auth.bunkerConnecting}
        bunkerError={auth.bunkerError}
        setBunkerError={auth.setBunkerError}
        authChallengeUrl={auth.authChallengeUrl}
        readOnlyInputKey={auth.readOnlyInputKey}
        setReadOnlyInputKey={auth.setReadOnlyInputKey}
        nostrConnectUri={auth.nostrConnectUri}
        isNostrConnectListening={auth.isNostrConnectListening}
        hasNostrExtension={auth.hasNostrExtension}
        nostrUser={auth.nostrUser}
        handleStartNostrConnect={auth.handleStartNostrConnect}
        handleDirectBunkerManualLogin={auth.handleDirectBunkerManualLogin}
        handleDirectExtensionLogin={auth.handleDirectExtensionLogin}
        handleDirectReadOnlyLogin={auth.handleDirectReadOnlyLogin}
        profileEditName={auth.profileEditName}
        setProfileEditName={auth.setProfileEditName}
        profileEditPicture={auth.profileEditPicture}
        setProfileEditPicture={auth.setProfileEditPicture}
        selectedImageFile={auth.selectedImageFile}
        cropZoom={auth.cropZoom}
        setCropZoom={auth.setCropZoom}
        cropOffset={auth.cropOffset}
        setCropOffset={auth.setCropOffset}
        isDraggingPhoto={auth.isDraggingPhoto}
        setIsDraggingPhoto={auth.setIsDraggingPhoto}
        dragStartRef={auth.dragStartRef}
        isDraggingAvatar={auth.isDraggingAvatar}
        setIsDraggingAvatar={auth.setIsDraggingAvatar}
        handleFileSelection={auth.handleFileSelection}
        handlePublishProfile={auth.handlePublishProfile}
        profileStatus={auth.profileStatus}
        isPublishingProfile={auth.isPublishingProfile}
        publishingStep={auth.publishingStep}
      />
    </div>
  );
}

export default App;
