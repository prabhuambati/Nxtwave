import { mountRobotScene } from "./robot-scene.js";
import {
  fetchLeaderboard,
  fetchPublicCreations,
  getThumbnailUrl,
  isCreationLiked,
  isOwnCreation,
  leaderboardConfigured,
  likeCreation,
  publishCreation,
  reportCreation,
  withdrawCreation
} from "./supabase-leaderboard.js";
import {
  createCreationUrl,
  DEFAULT_CREATION,
  readCreationFromUrl
} from "./humanoid-creation.js";
import {
  claimReferralBonus,
  consumeImageCredit,
  prepareImageCanvas,
  readImageCredits,
  validateImageFile
} from "./humanoid-image.js";

const container = document.querySelector("#robotScene");
const sceneStatus = document.querySelector("#sceneStatus");
const sceneCaption = document.querySelector(".scene-caption");
const poseControls = document.querySelector("#poseControls");
const poseStatus = document.querySelector("#poseStatus");
const poseButtons = [...document.querySelectorAll("[data-pose]")];
const componentControls = document.querySelector("#componentControls");
const imageControls = document.querySelector("#imageControls");
const componentButtons = [...document.querySelectorAll("[data-component]")];
const componentStatus = document.querySelector("#componentStatus");
const componentList = document.querySelector("#componentList");
const undoButton = document.querySelector("#undoComponent");
const resetButton = document.querySelector("#resetComponents");
const resetCreationButton = document.querySelector("#resetCreation");
const creationSummary = document.querySelector("#creationSummary");
const shareCreationButton = document.querySelector("#shareCreation");
const copyShareLinkButton = document.querySelector("#copyShareLink");
const creationShareStatus = document.querySelector("#creationShareStatus");
const creationShareFallback = document.querySelector("#creationShareFallback");
const creationShareUrl = document.querySelector("#creationShareUrl");
const copyCreationLinkButton = document.querySelector("#copyCreationLink");
const imageFileInput = document.querySelector("#imageFile");
const sceneImageTray = document.querySelector("#sceneImageTray");
const imageTrayItem = document.querySelector("#imageTrayItem");
const imageTrayThumbnail = document.querySelector("#imageTrayThumbnail");
const imageTrayLabel = document.querySelector("#imageTrayLabel");
const cancelImageUploadButton = document.querySelector("#cancelImageUpload");
const imagePreview = document.querySelector("#imagePreview");
const imagePreviewImg = document.querySelector("#imagePreviewImg");
const imageFileName = document.querySelector("#imageFileName");
const imageDimensions = document.querySelector("#imageDimensions");
const imageCreditsRemaining = document.querySelector("#imageCreditsRemaining");
const imageStatus = document.querySelector("#imageStatus");
const replayImageTutorialButton = document.querySelector("#replayImageTutorial");
const imageTutorial = document.querySelector("#imageTutorial");
const imageTutorialTitle = document.querySelector("#imageTutorialTitle");
const imageTutorialText = document.querySelector("#imageTutorialText");
const imageTutorialStart = document.querySelector("#imageTutorialStart");
const imageTutorialContinue = document.querySelector("#imageTutorialContinue");
const imageTutorialSkip = document.querySelector("#imageTutorialSkip");
const imageTutorialDontShow = document.querySelector("#imageTutorialDontShow");
const creatorDisplayName = document.querySelector("#creatorDisplayName");
const publishConsent = document.querySelector("#publishConsent");
const publishCreationButton = document.querySelector("#publishCreation");
const publishStatus = document.querySelector("#publishStatus");
const publishSuccess = document.querySelector("#publishSuccess");
const galleryStatus = document.querySelector("#galleryStatus");
const galleryList = document.querySelector("#galleryList");
const leaderboardStatus = document.querySelector("#leaderboardStatus");
const leaderboardList = document.querySelector("#leaderboardList");
const routeSections = [...document.querySelectorAll("[data-route]")];
const navLinks = [...document.querySelectorAll("[data-nav]")];
let sceneController;
let sceneCanvas;
let handledDropDuringDrag = false;
let suppressDragClick = false;
let currentCreationUrl = "";
let pendingImage = null;
let imagePlacementArmed = false;
let imagePlacementPointer = null;
let nextImageLabel = 1;
let imageCreditsRemainingCount = readImageCredits();
let imageTutorialState = "ready";
const IMAGE_TUTORIAL_STORAGE_KEY = "nxtwaveBot.imagePlacementTutorial.v1";
const imageBadgeLabels = new Map();
const sharedCreation = readCreationFromUrl(window.location.href);
const componentNames = new Map(componentButtons.map(button => [button.dataset.component, button.textContent]));

poseControls.hidden = false;
componentControls.hidden = false;
imageControls.hidden = false;
poseButtons.forEach(button => { button.disabled = true; });
componentButtons.forEach(button => { button.disabled = true; });
undoButton.disabled = true;
resetButton.disabled = true;
resetCreationButton.disabled = true;
shareCreationButton.disabled = true;
copyShareLinkButton.disabled = true;

document.body.classList.add("robot-branded");
document.title = "NxtWave's Doodles — Decorate the NxtWave Bot";
sceneCaption.textContent = "Drag accessories onto the bot, upload an image, and make it yours.";
sceneStatus.textContent = "Loading the local humanoid model…";
shareCreationButton.textContent = "Share Your Bot";

try {
  sceneController = await mountRobotScene(container, report => {
    const missingBones = report.requiredBones.filter(bone => !bone.name).map(bone => bone.role);
    sceneStatus.dataset.kind = missingBones.length ? "error" : "success";
    sceneStatus.textContent = missingBones.length
      ? `Model rendered with ${missingBones.length} expected pose bone(s) missing.`
      : "Robot rendered successfully and is ready to decorate.";
  }, error => {
    console.error("Could not load the local humanoid GLB.", error);
    sceneStatus.dataset.kind = "error";
    sceneStatus.textContent = "The humanoid model could not be loaded. Confirm public/models/RobotExpressive.glb is available.";
  });
  if (sceneController) {
    sceneCanvas = container.querySelector("canvas");
    poseButtons.forEach(button => { button.disabled = false; });
    componentButtons.forEach(button => { button.disabled = false; });
    const nativeDragSupported = navigator.maxTouchPoints === 0 && window.matchMedia("(pointer: fine)").matches;
    componentButtons.forEach(button => { button.draggable = nativeDragSupported; });
    componentStatus.textContent = "Ready. Select or drag a component onto the character.";
    updateSelectedPose("idle");
    poseStatus.textContent = "Idle pose selected.";
    poseButtons.forEach(button => button.addEventListener("click", handlePoseButtonClick));
    componentButtons.forEach(button => {
      button.addEventListener("click", handleComponentButtonClick);
      button.addEventListener("dragstart", handleComponentDragStart);
      button.addEventListener("dragend", handleComponentDragEnd);
    });
    sceneCanvas.addEventListener("componentplaced", handleComponentPlaced);
    sceneCanvas.addEventListener("componentfused", handleComponentFused);
    undoButton.addEventListener("click", handleUndo);
    resetButton.addEventListener("click", handleReset);
    resetCreationButton.addEventListener("click", handleResetCreation);
    shareCreationButton.addEventListener("click", handleShareCreation);
    copyShareLinkButton.addEventListener("click", handleCopyCreationLink);
    copyCreationLinkButton.addEventListener("click", handleCopyCreationLink);
    componentList.addEventListener("click", handleComponentListClick);
    imageFileInput.addEventListener("change", handleImageFileChange);
    imageTrayItem.addEventListener("click", handleImageTrayClick);
    cancelImageUploadButton.addEventListener("click", handleCancelImageUpload);
    replayImageTutorialButton.addEventListener("click", replayImagePlacementTutorial);
    document.querySelector("#navHelp")?.addEventListener("click", replayImagePlacementTutorial);
    document.querySelector("#navShare")?.addEventListener("click", () => shareCreationButton.click());
    const shareCreditsButton = document.querySelector("#shareCreditsButton");
    const shareCreditsStatus = document.querySelector("#shareCreditsStatus");
    shareCreditsButton?.addEventListener("click", async () => {
      shareCreditsButton.disabled = true;
      shareCreditsStatus.textContent = "Preparing your share link…";
      shareCreationButton.click();
      window.setTimeout(() => {
        shareCreditsStatus.textContent = "Link ready or shared. No bonus credits were added automatically; a credit requires verified eligible referral placement.";
        shareCreditsButton.disabled = false;
      }, 500);
    });
    imageTutorialStart.addEventListener("click", startImagePlacementTutorial);
    imageTutorialContinue.addEventListener("click", dismissImagePlacementTutorial);
    imageTutorialSkip.addEventListener("click", dismissImagePlacementTutorial);
    creatorDisplayName.addEventListener("input", updatePublishControls);
    publishConsent.addEventListener("change", updatePublishControls);
    publishCreationButton.addEventListener("click", handlePublishCreation);
    setupNavigation();
    document.querySelectorAll("[data-gallery-sort]").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-gallery-sort]").forEach(item => item.classList.toggle("active", item === button));
        refreshGallery(button.dataset.gallerySort);
      });
    });
    refreshGallery("top");
    refreshLeaderboard();
    updatePublishControls();
    document.addEventListener("pointerdown", handleImagePlacementPointerDown);
    document.addEventListener("pointermove", handleImagePlacementPointerMove);
    document.addEventListener("pointerup", handleImagePlacementPointerUp);
    document.addEventListener("pointercancel", handleImagePlacementPointerCancel);
    resetCreationButton.disabled = false;
    shareCreationButton.disabled = false;
    if (sharedCreation.valid && sharedCreation.shared) {
      sceneController.restoreCreation(sharedCreation.recipe);
      updateSelectedPose(sharedCreation.recipe.pose);
      poseStatus.textContent = `${poseLabel(sharedCreation.recipe.pose)} pose restored from the shared creation.`;
      componentStatus.textContent = "Shared creation restored. Continue adding, removing, or posing components.";
    } else if (!sharedCreation.valid) {
      componentStatus.textContent = "That shared creation was invalid or unsupported; the default character is shown.";
      poseStatus.textContent = "Invalid shared creation. Idle pose selected.";
      removeInvalidCreationParameter();
    }
    refreshComponentList();
    refreshImageBadges();
    refreshImageCredits();
  }
} catch (error) {
  console.error("Could not initialize the humanoid preview.", error);
  poseStatus.textContent = "Pose presets are unavailable because the humanoid could not be loaded.";
}

function updateSelectedPose(pose) {
  poseButtons.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.pose === pose));
  });
}

function handlePoseButtonClick(event) {
  const { currentTarget: button } = event;
  try {
    if (imagePlacementArmed) cancelImagePlacement();
    const label = sceneController.setPose(button.dataset.pose);
    updateSelectedPose(button.dataset.pose);
    poseStatus.textContent = `${label} pose selected.`;
    refreshComponentList();
  } catch (error) {
    console.error("Could not apply the humanoid pose.", error);
    poseStatus.textContent = "That pose could not be applied to this rig.";
  }
}

function updateSelectedComponent(id) {
  componentButtons.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.component === id));
  });
}

function handleComponentButtonClick(event) {
  const { currentTarget: button } = event;
  if (suppressDragClick) {
    event.preventDefault();
    suppressDragClick = false;
    return;
  }
  try {
    sceneController.setSelectedComponent(button.dataset.component);
    updateSelectedComponent(button.dataset.component);
    componentStatus.textContent = `${button.textContent} selected. Tap or click a highlighted area on the character to add it.`;
  } catch (error) {
    console.error("Could not select the humanoid component.", error);
    componentStatus.textContent = "That component could not be selected.";
  }
}

function handleComponentDragStart(event) {
  const { currentTarget: button } = event;
  event.dataTransfer.setData("text/plain", button.dataset.component);
  event.dataTransfer.effectAllowed = "copy";
  sceneController.beginComponentDrag(button.dataset.component);
  handledDropDuringDrag = false;
  updateSelectedComponent(null);
  componentStatus.textContent = `Drag ${button.textContent} onto the character.`;
}

function handleComponentDragEnd(event) {
  const { currentTarget: button } = event;
  sceneController.endComponentDrag();
  suppressDragClick = true;
  window.setTimeout(() => { suppressDragClick = false; }, 0);
  if (!handledDropDuringDrag) {
    componentStatus.textContent = "Drag cancelled. Select a component and click the character to add it.";
  }
  button.blur();
}

function handleComponentPlaced(event) {
  handledDropDuringDrag = true;
  const component = event.detail;
  if (!component) {
    componentStatus.textContent = "Drop onto a visible part of the character to attach a component.";
    return;
  }
  updateSelectedComponent(null);
  const name = componentNames.get(component.id) ?? component.id;
  componentStatus.textContent = `${name} is fusing to the ${component.anchor}.`;
  refreshComponentList();
}

function handleComponentFused(event) {
  const name = componentNames.get(event.detail.id) ?? event.detail.id;
  componentStatus.textContent = `${name} attached to the ${event.detail.anchor}.`;
  refreshComponentList();
}

function refreshComponentList() {
  const components = sceneController?.getComponents() ?? [];
  componentList.replaceChildren(...components.map((component, index) => {
    const item = document.createElement("li");
    item.className = "component-chip";
    item.dataset.instanceId = String(component.instanceId);
    const label = document.createElement("span");
    label.textContent = `${componentNames.get(component.id) ?? component.id} ${index + 1}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.removeComponent = String(component.instanceId);
    remove.setAttribute("aria-label", `Remove ${componentNames.get(component.id) ?? component.id} ${index + 1}`);
    remove.textContent = "×";
    item.append(label, remove);
    return item;
  }));
  undoButton.disabled = components.length === 0;
  resetButton.disabled = components.length === 0;
  const creation = sceneController?.getCreation();
  if (creation) {
    const badges = sceneController.getImageBadges().length;
    const badgeSummary = badges ? ` · ${badges} uploaded ${badges === 1 ? "image" : "images"} (not shared)` : "";
    creationSummary.textContent = `Current pose: ${poseLabel(creation.pose)} · ${components.length} ${components.length === 1 ? "component" : "components"}${badgeSummary}`;
  }
}

function handleUndo() {
  if (sceneController?.undoLastComponent()) componentStatus.textContent = "Last added component removed.";
  refreshComponentList();
}

function handleReset() {
  cancelImagePlacement();
  sceneController?.resetComponents();
  componentStatus.textContent = "All attached components removed.";
  refreshComponentList();
}

function handleResetCreation() {
  if (!window.confirm("Reset this creation to the default Idle character and remove all components and uploaded images?")) return;
  sceneController?.restoreCreation(DEFAULT_CREATION);
  updateSelectedPose(DEFAULT_CREATION.pose);
  poseStatus.textContent = "Idle pose selected.";
  updateSelectedComponent(null);
  componentStatus.textContent = "Creation reset. Add components or choose a pose to begin again.";
  currentCreationUrl = "";
  creationShareUrl.value = "";
  creationShareFallback.hidden = true;
  copyShareLinkButton.disabled = true;
  creationShareStatus.textContent = "";
  creationShareStatus.removeAttribute("data-kind");
  removeInvalidCreationParameter();
  clearPendingImage();
  imageBadgeLabels.clear();
  refreshImageBadges();
  refreshComponentList();
  setImageStatus("Creation reset; uploaded images and the pending upload were removed.", "success");
}

async function handleShareCreation() {
  try {
    currentCreationUrl = createCreationUrl(sceneController.getCreation(), window.location.href);
    const referralUrl = new URL(currentCreationUrl);
    let referralCode = localStorage.getItem("nxtwaveBot.referralCode.v1");
    if (!referralCode) {
      referralCode = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
      localStorage.setItem("nxtwaveBot.referralCode.v1", referralCode);
    }
    referralUrl.searchParams.set("ref", referralCode);
    currentCreationUrl = referralUrl.toString();
    creationShareUrl.value = currentCreationUrl;
    copyShareLinkButton.disabled = false;
    const sharedUrl = new URL(currentCreationUrl);
    window.history.replaceState(null, "", `${sharedUrl.pathname}${sharedUrl.search}${sharedUrl.hash}`);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Decorate the NxtWave Bot", text: "See and remix my NxtWave Bot creation.", url: currentCreationUrl });
        creationShareFallback.hidden = true;
        setShareStatus("Bot link shared. Bonus credits require a measurable eligible placement and work only as a browser-local prototype.", "success");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyCurrentCreationLink();
  } catch (error) {
    console.error("Could not create the humanoid share link.", error);
    currentCreationUrl = "";
    copyShareLinkButton.disabled = true;
    creationShareFallback.hidden = true;
    setShareStatus(error instanceof Error ? error.message : "The creation link could not be generated.", "error");
  }
}

async function handleCopyCreationLink() {
  await handleShareCreation();
}

async function copyCurrentCreationLink() {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable in this browser.");
    await navigator.clipboard.writeText(currentCreationUrl);
    creationShareFallback.hidden = true;
    const badgeCount = sceneController.getImageBadges().length;
    const localNote = badgeCount
      ? ` ${badgeCount} uploaded ${badgeCount === 1 ? "image is" : "images are"} local and will not appear for recipients.`
      : "";
    setShareStatus(`Creation link copied. Anyone with the link can open and continue this creation.${localNote}`, "success");
  } catch (error) {
    creationShareFallback.hidden = false;
    creationShareUrl.focus();
    creationShareUrl.select();
    const localNote = sceneController.getImageBadges().length
      ? " Uploaded images are local and are not included in the link."
      : "";
    setShareStatus(`Clipboard access failed. The link is selected below so you can copy it manually.${localNote}`, "error");
  }
}

function setShareStatus(message, kind) {
  creationShareStatus.textContent = message;
  creationShareStatus.dataset.kind = kind;
}

function poseLabel(pose) {
  return poseButtons.find(button => button.dataset.pose === pose)?.textContent ?? pose;
}

function removeInvalidCreationParameter() {
  const url = new URL(window.location.href);
  url.searchParams.delete("creation");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function handleImageFileChange() {
  const file = imageFileInput.files?.[0];
  clearPendingImage();
  if (!file) return;

  try {
    validateImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    try {
      const prepared = await prepareImageCanvas(file);
      pendingImage = { file, previewUrl, ...prepared };
      imagePreviewImg.src = previewUrl;
      imageTrayThumbnail.src = previewUrl;
      imageTrayThumbnail.alt = `Uploaded ${file.name}`;
      imageTrayLabel.textContent = file.name;
      imageTrayItem.setAttribute("aria-label", `Drag or tap ${file.name} to place it on the character`);
      sceneImageTray.hidden = false;
      imageTrayItem.hidden = false;
      imageTrayItem.disabled = false;
      imageFileName.textContent = file.name;
      imageDimensions.textContent = `${prepared.width} × ${prepared.height} px · ${formatBytes(file.size)}`;
      imagePreview.hidden = false;
      cancelImageUploadButton.disabled = false;
      setImageStatus("Image decoded locally and added to the component tray. Drag it onto the character, or tap it and then tap a surface.", "success");
      sceneImageTray.scrollIntoView({ block: "center", behavior: "smooth" });
      showFirstImageTutorial();
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      throw error;
    }
  } catch (error) {
    imageFileInput.value = "";
    setImageStatus(error instanceof Error ? error.message : "The image could not be processed.", "error");
  }
}

function beginImagePlacement() {
  if (!pendingImage) return false;
  if (readImageCredits() <= 0) {
    setImageStatus("No image-upload credits remain. Credits are browser-local and may be reset by clearing storage.", "error");
    return false;
  }
  try {
    sceneController.beginImagePlacement(pendingImage.canvas);
    imagePlacementArmed = true;
    setImageStatus("Image selected. Drag over the character and release on a highlighted surface, or tap a surface to place it.", "success");
    return true;
  } catch (error) {
    setImageStatus(error instanceof Error ? error.message : "The image badge could not be added.", "error");
    return false;
  }
}

function handleImageTrayClick(event) {
  if (event.detail === 0 && !imagePlacementArmed) beginImagePlacement();
}

function handleImagePlacementPointerDown(event) {
  if (!sceneController) return;
  const isCanvas = event.target === sceneCanvas || sceneCanvas?.contains(event.target);
  const isImageTray = event.target instanceof Element && Boolean(event.target.closest("#imageTrayItem"));
  if (isImageTray && !imagePlacementArmed && !beginImagePlacement()) return;
  if (!imagePlacementArmed || imagePlacementPointer) return;
  if (!isCanvas && !isImageTray) return;
  imagePlacementPointer = {
    pointerId: event.pointerId,
    source: isCanvas ? "canvas" : "tray",
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
}

function handleImagePlacementPointerMove(event) {
  if (!imagePlacementArmed) return;
  if (imagePlacementPointer?.pointerId === event.pointerId) {
    const distance = Math.hypot(
      event.clientX - imagePlacementPointer.startX,
      event.clientY - imagePlacementPointer.startY
    );
    if (distance > 6) imagePlacementPointer.moved = true;
  }
  const hit = sceneController.updateImagePlacementAt(event.clientX, event.clientY);
  if (hit) {
    updateTutorialPlacementFeedback(true, hit.anchor);
  }
  if (hit && imagePlacementPointer?.moved) {
    setImageStatus(`Valid surface: ${hit.anchor}. Release to attach the image.`, "success");
  } else if (!hit && imagePlacementPointer?.moved) {
    setImageStatus("No character surface here. Move over the character to place the image.", "error");
  }
}

function handleImagePlacementPointerUp(event) {
  if (!imagePlacementPointer || imagePlacementPointer.pointerId !== event.pointerId) return;
  const pointer = imagePlacementPointer;
  imagePlacementPointer = null;
  const isCanvas = isPointInsideCanvas(event.clientX, event.clientY);
  const releasedOnTray = event.target instanceof Element && Boolean(event.target.closest("#sceneImageTray"));
  if (pointer.source === "tray" && !pointer.moved && (releasedOnTray || !isCanvas)) {
    sceneController.updateImagePlacementAt(event.clientX, event.clientY);
    setImageStatus("Image selected. Tap or drag it onto a visible character surface.", "success");
    return;
  }
  if (isCanvas) {
    const badge = sceneController.completeImagePlacementAt(event.clientX, event.clientY);
    if (badge) {
      imagePlacementArmed = false;
      const label = imagePlacementLabel(badge.imageId);
      if (!imageBadgeLabels.has(badge.imageId)) {
        imageBadgeLabels.set(badge.imageId, pendingImage?.file.name || `Image ${nextImageLabel++}`);
      }
      refreshImageBadges(badge.imageId);
      refreshComponentList();
      tutorialPlacementSuccess(badge.anchor);
      if (pendingImage && !badge.repositioned) {
        try {
          imageCreditsRemainingCount = consumeImageCredit();
          const referralCode = new URL(window.location.href).searchParams.get("ref");
          if (referralCode) {
            const referral = claimReferralBonus(referralCode);
            if (referral.claimed) {
              imageCreditsRemainingCount = referral.credits;
              setImageStatus(`Image placed. Referral bonus claimed: 5 extra credits. Browser-local verification only; not securely attributable.`, "success");
            }
          }
          refreshImageCredits();
        } catch (error) {
          setImageStatus(error instanceof Error ? error.message : "No image credits remain.", "error");
          return;
        }
      }
      setImageStatus(`${label} attached to ${badge.anchor}. It is local to this tab and is not included in share links.`, "success");
      return;
    }
  }
  cancelImagePlacement();
  tutorialPlacementMiss();
  setImageStatus("Placement cancelled. Drop the image directly on a visible part of the character.", "error");
}

function handleImagePlacementPointerCancel(event) {
  if (imagePlacementPointer?.pointerId !== event.pointerId) return;
  cancelImagePlacement();
  tutorialPlacementMiss();
  setImageStatus("Image placement cancelled.", "success");
}

function isPointInsideCanvas(clientX, clientY) {
  if (!sceneCanvas) return false;
  const bounds = sceneCanvas.getBoundingClientRect();
  return clientX >= bounds.left && clientX <= bounds.right &&
    clientY >= bounds.top && clientY <= bounds.bottom;
}

function readImageTutorialPreference() {
  try { return localStorage.getItem("nxtwaveBot.imagePlacementTutorial.v1") || ""; } catch { return ""; }
}

function persistImageTutorialPreference(value) {
  try { localStorage.setItem("nxtwaveBot.imagePlacementTutorial.v1", value); } catch {}
}

function showFirstImageTutorial() {
  if (readImageTutorialPreference()) return;
  showImageTutorialReady();
}

function showImageTutorialReady() {
  imageTutorialState = "ready";
  imageTutorialTitle.textContent = "Your image is ready";
  imageTutorialText.textContent = "Your uploaded image is ready to place on the bot.";
  imageTutorialStart.hidden = false;
  imageTutorialContinue.hidden = true;
  imageTutorial.hidden = false;
  container.closest(".scene-shell")?.classList.remove("tutorial-highlight");
}

function replayImagePlacementTutorial() {
  if (!pendingImage) {
    imageTutorialState = "ready";
    imageTutorialTitle.textContent = "Upload an image first";
    imageTutorialText.textContent = "Choose a PNG, JPEG, or WebP image, then use this tutorial to place it.";
    imageTutorialStart.hidden = true;
    imageTutorialContinue.hidden = false;
    imageTutorialContinue.textContent = "Continue decorating";
    imageTutorial.hidden = false;
    return;
  }
  showImageTutorialReady();
}

function startImagePlacementTutorial() {
  if (!beginImagePlacement()) return;
  imageTutorialState = "placement";
  imageTutorialTitle.textContent = "Place your image";
  imageTutorialText.textContent = "Click or tap anywhere on the bot to place your image.";
  imageTutorialStart.hidden = true;
  imageTutorialContinue.hidden = true;
  imageTutorial.hidden = false;
  container.closest(".scene-shell")?.classList.add("tutorial-highlight");
}

function updateTutorialPlacementFeedback(valid, anchor = "") {
  if (imageTutorialState !== "placement") return;
  if (valid) {
    imageTutorialTitle.textContent = "Good surface";
    imageTutorialText.textContent = `Click or tap to attach it${anchor ? ` to ${anchor}` : ""}.`;
  }
}

function tutorialPlacementMiss() {
  if (imageTutorialState !== "placement") return;
  imageTutorialTitle.textContent = "Try a visible surface";
  imageTutorialText.textContent = "The drop missed the bot. Click or tap the head, torso, arm, hand, leg, or foot.";
}

function tutorialPlacementSuccess(anchor) {
  if (imageTutorialState !== "placement" && imageTutorialState !== "ready") return;
  if (imageTutorialState === "ready" && readImageTutorialPreference()) return;
  imageTutorialState = "success";
  imageTutorialTitle.textContent = "Nice!";
  imageTutorialText.textContent = `Nice! Your image is attached to the bot${anchor ? ` on the ${anchor}` : ""}.`;
  imageTutorialStart.hidden = true;
  imageTutorialContinue.hidden = false;
  imageTutorialContinue.textContent = "Continue decorating";
  imageTutorial.hidden = false;
  container.closest(".scene-shell")?.classList.remove("tutorial-highlight");
  persistImageTutorialPreference(imageTutorialDontShow.checked ? "dont-show" : "completed");
}

function dismissImagePlacementTutorial() {
  persistImageTutorialPreference(imageTutorialDontShow.checked ? "dont-show" : "completed");
  imageTutorial.hidden = true;
  container.closest(".scene-shell")?.classList.remove("tutorial-highlight");
  imageTutorialState = "dismissed";
}

function cancelImagePlacement() {
  sceneController?.cancelImagePlacement();
  imagePlacementArmed = false;
  imagePlacementPointer = null;
}

function imagePlacementLabel(imageId) {
  return imageBadgeLabels.get(imageId) ?? pendingImage?.file.name ?? "Image";
}

function handleCancelImageUpload() {
  cancelImagePlacement();
  clearPendingImage();
  setImageStatus("The pending image upload was cancelled. Added badges are unchanged.", "success");
}

function clearPendingImage() {
  cancelImagePlacement();
  imageTutorial.hidden = true;
  container.closest(".scene-shell")?.classList.remove("tutorial-highlight");
  if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
  pendingImage = null;
  imagePreview.hidden = true;
  imagePreviewImg.removeAttribute("src");
  imageFileName.textContent = "";
  imageDimensions.textContent = "";
  imageFileInput.value = "";
  imageTrayThumbnail.removeAttribute("src");
  imageTrayThumbnail.alt = "";
  imageTrayLabel.textContent = "Uploaded image";
  sceneImageTray.hidden = true;
  imageTrayItem.hidden = true;
  imageTrayItem.disabled = true;
  cancelImageUploadButton.disabled = true;
}

function refreshImageBadges() {
  // Uploaded image placement is session-local and intentionally has no
  // selection-based badge controls in the main customization UI.
}

function refreshImageCredits() {
  imageCreditsRemainingCount = readImageCredits();
  if (imageCreditsRemaining) {
    imageCreditsRemaining.textContent = `${imageCreditsRemainingCount} upload credit${imageCreditsRemainingCount === 1 ? "" : "s"} remaining`;
  }
}

function updatePublishControls() {
  publishCreationButton.disabled = !leaderboardConfigured ||
    creatorDisplayName.value.trim().length < 2 || !publishConsent.checked;
}

function setupNavigation() {
  const applyRoute = () => {
    const hashRoute = location.hash.slice(1);
    const hashBasedRoute = ["create", "gallery", "leaderboard", "about", "workshop", "workshop-register"].includes(hashRoute)
      ? hashRoute
      : null;
    const workshopPath = location.pathname.startsWith("/workshop/register") ? "workshop-register"
      : location.pathname === "/workshop" ? "workshop"
      : null;
    const route = hashBasedRoute || workshopPath || "create";
    routeSections.forEach(section => {
      section.hidden = section.dataset.route !== route;
    });
    navLinks.forEach(link => link.classList.toggle("active", link.dataset.nav === route));
    if (route === "gallery") refreshGallery(getActiveGallerySort());
    if (route === "leaderboard") refreshLeaderboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  window.addEventListener("hashchange", applyRoute);
  window.addEventListener("popstate", applyRoute);
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", () => {
      if (location.pathname !== "/") {
        window.history.pushState({}, "", `/${link.getAttribute("href")}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    });
  });
  applyRoute();
  setupWorkshopRegistration();
}

function setupWorkshopRegistration() {
  const button = document.querySelector("#workshopRegisterButton");
  if (!button) return;
  button.addEventListener("click", () => {
    window.history.pushState({}, "", "/workshop/register");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  const form = document.querySelector("#workshopDemoForm");
  const confirmation = document.querySelector("#workshopDemoConfirmation");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (confirmation) {
      confirmation.hidden = false;
      confirmation.textContent = "Demo confirmation: this is a visual demo only. No real registration was created and your details were not sent or saved.";
    }
  });
}

function getActiveGallerySort() {
  return document.querySelector("[data-gallery-sort].active")?.dataset.gallerySort ?? "top";
}

function setStatus(element, message, kind = "") {
  if (!element) return;
  element.textContent = message;
  if (kind) element.dataset.kind = kind;
  else element.removeAttribute("data-kind");
}

function addCardActions(card, entry, showWithdraw = true) {
  const actions = document.createElement("div");
  actions.className = "gallery-card-actions";
  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.className = "like-button";
  likeButton.dataset.leaderboardAction = "like";
  likeButton.dataset.creationId = entry.id;
  const initiallyLiked = isCreationLiked(entry.id);
  likeButton.textContent = `${initiallyLiked ? "♥" : "♡"} ${entry.like_count ?? 0}`;
  likeButton.classList.toggle("liked", initiallyLiked);
  likeButton.disabled = initiallyLiked;
  likeButton.setAttribute("aria-pressed", String(initiallyLiked));
  likeButton.setAttribute("aria-label", initiallyLiked ? `Liked. ${entry.like_count ?? 0} likes` : `Like ${entry.display_name}`);
  likeButton.addEventListener("click", async () => {
    likeButton.disabled = true;
    try {
      const added = await likeCreation(entry.id);
      await Promise.all([refreshGallery(getActiveGallerySort()), refreshLeaderboard()]);
      setStatus(galleryStatus, added ? "Like recorded. The public count was refreshed." : "You have already liked this bot.", added ? "success" : "");
    } catch (error) {
      setStatus(galleryStatus, error.message || "The like could not be recorded. Please try again.", "error");
    } finally {
      likeButton.disabled = false;
    }
  });
  const reportButton = document.createElement("button");
  reportButton.type = "button";
  reportButton.className = "report-button";
  reportButton.dataset.leaderboardAction = "report";
  reportButton.dataset.creationId = entry.id;
  reportButton.textContent = "Report";
  reportButton.addEventListener("click", async () => {
    const reason = window.prompt("Why are you reporting this bot? (3–240 characters)");
    if (!reason?.trim()) return;
    reportButton.disabled = true;
    try {
      await reportCreation(entry.id, reason.trim());
      setStatus(galleryStatus, "Report submitted for moderator review.", "success");
    } catch (error) {
      setStatus(galleryStatus, error.message || "The report could not be submitted. Please try again.", "error");
    } finally {
      reportButton.disabled = false;
    }
  });
  actions.append(likeButton, reportButton);
  if (showWithdraw && isOwnCreation(entry.id)) {
    const withdrawButton = document.createElement("button");
    withdrawButton.type = "button";
    withdrawButton.className = "report-button";
    withdrawButton.dataset.leaderboardAction = "withdraw";
    withdrawButton.dataset.creationId = entry.id;
    withdrawButton.textContent = "Withdraw";
    withdrawButton.addEventListener("click", async () => {
      withdrawButton.disabled = true;
      try {
        const withdrawn = await withdrawCreation(entry.id);
        await Promise.all([refreshGallery(getActiveGallerySort()), refreshLeaderboard()]);
        setStatus(galleryStatus, withdrawn ? "Your bot was withdrawn from public results." : "This browser does not own that creation.", withdrawn ? "success" : "error");
      } catch (error) {
        setStatus(galleryStatus, error.message || "The withdrawal could not be completed.", "error");
      } finally {
        withdrawButton.disabled = false;
      }
    });
    actions.append(withdrawButton);
  }
  card.append(actions);
}

async function refreshGallery(sort = "top") {
  if (!leaderboardConfigured) {
    setStatus(galleryStatus, "Gallery is not configured yet.", "error");
    galleryList.innerHTML = '<div class="error-state">Add the Supabase migration and environment variables, then restart Vite.</div>';
    return;
  }
  try {
    setStatus(galleryStatus, "Loading public creations…");
    galleryList.innerHTML = '<div class="gallery-skeleton"></div><div class="gallery-skeleton"></div><div class="gallery-skeleton"></div>';
    const entries = await fetchPublicCreations(sort);
    galleryList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = '<img src="/doodles/10.png" alt="" aria-hidden="true"><strong>No doodles yet.</strong><p>Be the first to publish your bot.</p><a class="share-button empty-action" href="#create">Create your first doodle</a>';
      galleryList.append(empty);
    } else {
      entries.forEach((entry, index) => {
        const card = document.createElement("article");
        card.className = "gallery-card";
        card.dataset.creationCard = entry.id;
        const thumb = document.createElement("div");
        thumb.className = "gallery-card-thumb";
        const url = getThumbnailUrl(entry.thumbnail_path);
        if (url) {
          const image = document.createElement("img");
          image.src = url;
          image.alt = `${entry.display_name} bot thumbnail`;
          image.loading = "lazy";
          thumb.append(image);
        }
        const rank = document.createElement("span");
        rank.className = "gallery-card-rank";
        rank.textContent = `#${index + 1}`;
        thumb.append(rank);
        const body = document.createElement("div");
        body.className = "gallery-card-body";
        const name = document.createElement("h3");
        name.textContent = entry.display_name;
        const meta = document.createElement("div");
        meta.className = "gallery-card-meta";
        meta.innerHTML = `<span>${entry.like_count ?? 0} likes</span>`;
        body.append(name, meta);
        addCardActions(body, entry);
        card.append(thumb, body);
        galleryList.append(card);
      });
    }
    setStatus(galleryStatus, `${entries.length} public creation${entries.length === 1 ? "" : "s"}.`, entries.length ? "success" : "");
  } catch (error) {
    setStatus(galleryStatus, error.message || "The gallery could not be loaded.", "error");
    galleryList.innerHTML = '<div class="error-state">Could not reach the public gallery. Please try again.</div>';
  }
}

async function refreshLeaderboard() {
  if (!leaderboardConfigured) {
    setStatus(leaderboardStatus, "Leaderboard is not configured yet.", "error");
    leaderboardList.replaceChildren();
    return;
  }
  try {
    setStatus(leaderboardStatus, "Loading public rankings…");
    leaderboardList.innerHTML = '<li class="leaderboard-skeleton"></li><li class="leaderboard-skeleton"></li><li class="leaderboard-skeleton"></li>';
    const entries = await fetchLeaderboard();
    leaderboardList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.innerHTML = '<img src="/doodles/11.png" alt="" aria-hidden="true"><strong>No rankings yet.</strong><p>Published creations will appear here as the community likes them.</p>';
      leaderboardList.append(empty);
    } else {
      entries.forEach((entry, index) => {
        const item = document.createElement("li");
        item.className = "leaderboard-row";
        const position = document.createElement("span");
        position.className = "leaderboard-position";
        position.textContent = String(index + 1);
        const image = document.createElement("img");
        const url = getThumbnailUrl(entry.thumbnail_path);
        if (url) image.src = url;
        image.alt = `${entry.display_name} bot thumbnail`;
        image.loading = "lazy";
        const copy = document.createElement("div");
        copy.className = "leaderboard-copy";
        copy.innerHTML = `<strong>${entry.display_name}</strong><span>Published creation</span>`;
        const actions = document.createElement("div");
        actions.className = "leaderboard-actions";
        const likes = document.createElement("span");
        likes.className = "leaderboard-likes";
        likes.textContent = `${entry.like_count ?? 0} likes`;
        const likeButton = document.createElement("button");
        likeButton.type = "button";
        likeButton.className = "leaderboard-like-button";
        likeButton.dataset.creationId = entry.id;
        const liked = isCreationLiked(entry.id);
        likeButton.textContent = liked ? "♥" : "♡";
        likeButton.classList.toggle("liked", liked);
        likeButton.disabled = liked;
        likeButton.setAttribute("aria-label", liked ? `Already liked ${entry.display_name}` : `Like ${entry.display_name}`);
        likeButton.setAttribute("aria-pressed", String(liked));
        likeButton.title = liked ? "You already liked this bot" : "Like this bot";
        likeButton.addEventListener("click", async () => {
          if (likeButton.disabled) return;
          likeButton.disabled = true;
          likeButton.setAttribute("aria-busy", "true");
          likeButton.textContent = "…";
          try {
            const added = await likeCreation(entry.id);
            await Promise.all([refreshGallery(getActiveGallerySort()), refreshLeaderboard()]);
            if (added) {
              const refreshedButton = leaderboardList.querySelector(`[data-creation-id="${CSS.escape(entry.id)}"]`);
              refreshedButton?.classList.add("like-success");
            }
            setStatus(leaderboardStatus, added ? "Like recorded and the ranking refreshed." : "You have already liked this bot.", added ? "success" : "error");
          } catch (error) {
            setStatus(leaderboardStatus, error.message || "Like failed. Please try again.", "error");
            likeButton.disabled = false;
            likeButton.textContent = "♡";
          } finally {
            likeButton.removeAttribute("aria-busy");
          }
        });
        actions.append(likes, likeButton);
        item.append(position, image, copy, actions);
        leaderboardList.append(item);
      });
    }
    setStatus(leaderboardStatus, entries.length ? `${entries.length} ranked creations by server-backed like count.` : "No public rankings yet.", entries.length ? "success" : "");
  } catch (error) {
    setStatus(leaderboardStatus, error.message || "The leaderboard could not be loaded.", "error");
  }
}

async function handlePublishCreation() {
  if (!publishConsent.checked || creatorDisplayName.value.trim().length < 2) return;
  publishCreationButton.disabled = true;
  try {
    setStatus(publishStatus, "Generating a thumbnail and publishing the recipe…");
    publishSuccess.hidden = true;
    const thumbnailBlob = await sceneController.exportThumbnail(512);
    await publishCreation({
      displayName: creatorDisplayName.value.trim(),
      recipe: sceneController.getCreation(),
      thumbnailBlob
    });
    publishConsent.checked = false;
    creatorDisplayName.value = "";
    updatePublishControls();
    setStatus(publishStatus, "Your bot and generated thumbnail were published.", "success");
    publishSuccess.hidden = false;
    await Promise.all([refreshGallery(), refreshLeaderboard()]);
  } catch (error) {
    updatePublishControls();
    setStatus(publishStatus, error.message || "The creation could not be published. Your current bot is unchanged.", "error");
  }
}

async function handleLeaderboardAction(event) {
  const button = event.target.closest("[data-leaderboardAction]");
  if (!button) return;
  const action = button.dataset.leaderboardAction;
  const creationId = button.dataset.creationId;
  button.disabled = true;
  try {
    let actionStatus = "";
    let actionKind = "";
    if (action === "like") {
      const added = await likeCreation(creationId);
      actionStatus = added ? "Like recorded. The public count was refreshed." : "You have already liked this bot.";
      actionKind = added ? "success" : "";
    } else if (action === "withdraw") {
      const withdrawn = await withdrawCreation(creationId);
      actionStatus = withdrawn ? "Your bot was withdrawn from public results." : "This browser does not own that creation.";
      actionKind = withdrawn ? "success" : "error";
    } else {
      const reason = window.prompt("Why are you reporting this bot? (3–240 characters)");
      if (!reason?.trim()) return;
      await reportCreation(creationId, reason.trim());
      setStatus(galleryStatus, "Report submitted for moderator review.", "success");
      return;
    }
    await Promise.all([refreshGallery(getActiveGallerySort()), refreshLeaderboard()]);
    setStatus(galleryStatus, actionStatus, actionKind);
  } catch (error) {
    setStatus(galleryStatus, error.message || "The action could not be completed. Please try again.", "error");
  } finally {
    button.disabled = false;
  }
}

function setImageStatus(message, kind) {
  imageStatus.textContent = message;
  imageStatus.dataset.kind = kind;
}

function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function handleComponentListClick(event) {
  const button = event.target.closest("[data-remove-component]");
  if (!button) return;
  const instanceId = Number(button.dataset.removeComponent);
  if (sceneController?.removeComponent(instanceId)) {
    componentStatus.textContent = "Component removed.";
  }
  refreshComponentList();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    poseButtons.forEach(button => button.removeEventListener("click", handlePoseButtonClick));
    componentButtons.forEach(button => {
      button.removeEventListener("click", handleComponentButtonClick);
      button.removeEventListener("dragstart", handleComponentDragStart);
      button.removeEventListener("dragend", handleComponentDragEnd);
    });
    sceneCanvas?.removeEventListener("componentplaced", handleComponentPlaced);
    sceneCanvas?.removeEventListener("componentfused", handleComponentFused);
    undoButton.removeEventListener("click", handleUndo);
    resetButton.removeEventListener("click", handleReset);
    resetCreationButton.removeEventListener("click", handleResetCreation);
    shareCreationButton.removeEventListener("click", handleShareCreation);
    copyShareLinkButton.removeEventListener("click", handleCopyCreationLink);
    copyCreationLinkButton.removeEventListener("click", handleCopyCreationLink);
    componentList.removeEventListener("click", handleComponentListClick);
    imageFileInput.removeEventListener("change", handleImageFileChange);
    imageTrayItem.removeEventListener("click", handleImageTrayClick);
    cancelImageUploadButton.removeEventListener("click", handleCancelImageUpload);
    replayImageTutorialButton.removeEventListener("click", replayImagePlacementTutorial);
    imageTutorialStart.removeEventListener("click", startImagePlacementTutorial);
    imageTutorialContinue.removeEventListener("click", dismissImagePlacementTutorial);
    imageTutorialSkip.removeEventListener("click", dismissImagePlacementTutorial);
    creatorDisplayName.removeEventListener("input", updatePublishControls);
    publishConsent.removeEventListener("change", updatePublishControls);
    publishCreationButton.removeEventListener("click", handlePublishCreation);
    leaderboardList.removeEventListener("click", handleLeaderboardAction);
    document.removeEventListener("pointerdown", handleImagePlacementPointerDown);
    document.removeEventListener("pointermove", handleImagePlacementPointerMove);
    document.removeEventListener("pointerup", handleImagePlacementPointerUp);
    document.removeEventListener("pointercancel", handleImagePlacementPointerCancel);
    clearPendingImage();
    sceneController?.dispose();
  });
}
