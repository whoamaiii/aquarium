/**
 * @file Provides a centralized store for simple global engine states.
 * These states are primarily intended for UI display or for other systems
 * to easily access shared status information, such as critical error messages,
 * the timestamp of the last save, or whether a save operation is currently active.
 */

/**
 * Holds a string message for any critical error that occurs within the engine,
 * such as GPU initialization failures or issues with saving/loading the simulation state.
 * This message is intended to be displayed to the user (e.g., in a HUD or error panel).
 * It is `null` when no critical error is currently active.
 * @public
 */
export let criticalErrorMessage: string | null = null;

/**
 * Stores the timestamp (typically from `Date.now()`) of the last successful save operation.
 * This can be used by the UI to inform the user when the game was last saved (e.g., "Last saved: HH:MM:SS").
 * It is `null` if no save operation has been completed yet in the current session.
 * @public
 */
export let lastSaveTime: number | null = null;

/**
 * A boolean flag indicating whether a save operation (`saveState()` in `persistence.ts`)
 * is currently in progress. This is useful for providing UI feedback, such as
 * displaying a "Saving..." indicator or disabling save-related UI elements temporarily.
 * @public
 */
export let isSaving: boolean = false;

/**
 * Sets the critical error message for the engine.
 * This function updates the `criticalErrorMessage` variable and also logs the
 * error message to the console for development and debugging purposes.
 * @param {string} message - The error message to set.
 * @public
 */
export function setCriticalError(message: string): void {
  criticalErrorMessage = message;
  console.error("Critical Engine Error: " + message); // Also log for developers.
}

/**
 * Clears any active critical error message by resetting `criticalErrorMessage` to `null`.
 * This should be called when an error condition is resolved or when starting operations
 * that might previously have set an error (e.g., at the beginning of GPU initialization).
 * @public
 */
export function clearCriticalError(): void {
  criticalErrorMessage = null;
}

/**
 * Updates the timestamp of the last successful save.
 * @param {number | null} time - The timestamp (e.g., `Date.now()`) of the last save, or `null` if it needs to be cleared.
 * @public
 */
export function setLastSaveTime(time: number | null): void {
  lastSaveTime = time;
}

/**
 * Sets the status of the `isSaving` flag.
 * This is called by the persistence system to indicate the start and end of a save operation.
 * @param {boolean} saving - True if a save is in progress, false otherwise.
 * @public
 */
export function setIsSaving(saving: boolean): void {
  isSaving = saving;
}
