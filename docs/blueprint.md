# **App Name**: DecoInnova Toolkit

## Core Features:

- Firebase Integration: Integrate the Firebase v9+ (modular) SDKs for Authentication and Firestore. Initialize Firebase within the React application.
- Anonymous Authentication: Implement Firebase Anonymous Authentication to automatically sign users in on their first visit. Use a `useEffect` hook in the main `App` component to manage the `onAuthStateChanged` listener, providing a stable `userId` for all database operations.
- Firestore Database Structure: Use a root collection named `projects`. Each document represents a project and contains userId, projectName, materials, surfaces, remnants, materialUsageCount, createdAt, and updatedAt.
- Home Page / Project Dashboard: Fetch and display a list of all projects from Firestore where the `userId` matches the current user's ID. Each project is clickable, navigating the user to the `EditorPage`. Includes a 'Create New Project' button to navigate to the `QuoterPage`. The 'Price Calculator' tool is accessible as a standalone utility.
- Quoter Page / Project Setup: Allows users to define the parameters for a new project: material definition (up to 3 materials), surface definition (1 to 6 surfaces). On 'Generate Plan' click, creates a new document in the `projects` collection in Firestore, populated with the form data and the current `userId`, then navigates the user to the `EditorPage`.
- Editor Page / Main Workspace: Fetches a single project document from Firestore based on the project ID from the URL. Uses an `onSnapshot` listener to keep project data in sync. All user actions trigger an automatic update to the Firestore document.
- Price Calculator: Replicates the original calculation logic precisely. The formula is: `basePrice = finalPriceWithIVA / (1 + IVARate / 100)`.
- Dynamic Scaling: The canvas must render a visual representation of the selected surface and calculate a scale factor (`editorScale`) to fit the surface's real-world dimensions into the available pixel space of the container.
- Placement Snapping Algorithm: Implements a snapping algorithm to determine precise placement coordinates by finding the nearest valid snap point against surface boundaries, previously placed pieces, and defined obstacles.
- Piece Fragmentation & Fill Mode: Implements a geometric subtraction function that takes two rectangles (the new piece and an obstacle/existing piece) and returns an array of smaller rectangles.
- Remnant Calculation: Calculates and adds any parts of a material piece that are cut off due to fragmentation and are of a usable size to the project's `remnants` array.
- Drag-Lock Feature: When enabled, after the user starts dragging a piece, the movement is locked to either the horizontal (X) or vertical (Y) axis, based on the initial direction of mouse movement.
- "Cut" Tool: Opens a modal allowing a user to define a series of vertical and horizontal cut lines on a full material sheet or a remnant. Calculates all the resulting rectangular sub-pieces and adds them to the project's `remnants` array in Firestore.
- Eraser Tool: Checks if the deleted piece was a full, uncut material sheet. If so, decrements the `materialUsageCount`. If it was a remnant or a partial piece, it is returned to the `remnants` array.
- Measurement Tool: Allows the user to click and drag on the canvas to draw a measurement box. Displays the real-world width and height of the box. These measurements can be saved to the project.
- Undo/Redo: Maintains functionality for editor actions by managing a local history of the project state.
- PDF Export: Generates a multi-page PDF report for the currently loaded project, including a summary page and a separate page for each surface.

## Style Guidelines:

- Primary: Soft sky blue (`#87CEEB`) for key UI elements.
- Background (Light): Very light blue (`#F0F8FF`).
- Background (Dark): Desaturated dark blue (`#293A4D`).
- Accent: Muted gold (`#B8860B`) for interactive elements and highlights.
- Body/Headline Font: 'Inter' (sans-serif).
- Code/Measurement Font: 'Source Code Pro'.
- Use modern, geometric SVG icons to represent tools and actions, ensuring clarity and intuitive interaction.
- Visual Fidelity: The new application's UI, layout, and responsiveness must be a precise match to the original `index.html` file.