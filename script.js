// Global variables
const tasks = []
const agentSkills = []
const globalSkills = []
let availablePrompts = []
let selectedSteps = []
let lastTranslationResponse = null
let currentPromptVersions = null
let selectedVersionId = null

// Base URL - modify this to match your API
const BASE_URL = "http://localhost:8019/api/v1" // Change this to your API URL

// Tab functionality
document.addEventListener("DOMContentLoaded", () => {
  initializeTabs()
  loadAvailablePrompts()
  updateAllDisplays()
})

function initializeTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn")
  const tabContents = document.querySelectorAll(".tab-content")

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab")

      // Remove active class from all tabs and contents
      tabBtns.forEach((b) => b.classList.remove("active"))
      tabContents.forEach((c) => c.classList.remove("active"))

      // Add active class to clicked tab and corresponding content
      btn.classList.add("active")
      document.getElementById(`${targetTab}-tab`).classList.add("active")

      // Update summaries when switching to execute tab
      if (targetTab === "execute") {
        updateExecutionSummary()
      }
    })
  })
}

function addTasksBulk() {
  const textarea = document.getElementById("tasksBulk")
  const newTasks = textarea.value
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t)

  if (newTasks.length > 0) {
    tasks.push(...newTasks)
    textarea.value = ""
    updateTaskDisplay()
  }
}

function removeTask(index) {
  tasks.splice(index, 1)
  updateTaskDisplay()
}

function updateTaskDisplay() {
  const displayArea = document.getElementById("taskDisplayArea")
  const emptyState = document.getElementById("emptyTaskState")
  const listDisplay = document.getElementById("taskListDisplay")

  if (tasks.length === 0) {
    emptyState.style.display = "flex"
    listDisplay.style.display = "none"
  } else {
    emptyState.style.display = "none"
    listDisplay.style.display = "block"

    listDisplay.innerHTML = ""
    tasks.forEach((task, index) => {
      const taskItem = document.createElement("div")
      taskItem.className = "task-item-display"
      taskItem.innerHTML = `
                <div style="display: flex; align-items: center; flex: 1;">
                    <div class="task-number">${index + 1}</div>
                    <div class="task-content">${escapeHtml(task)}</div>
                </div>
                <button class="remove-task-btn" onclick="removeTask(${index})">Remove</button>
            `
      listDisplay.appendChild(taskItem)
    })
  }
}

function addSkillsBulk(type) {
  const textarea = document.getElementById(`${type}SkillsBulk`)
  const skills = textarea.value
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s)

  if (skills.length > 0) {
    if (type === "agent") {
      agentSkills.push(...skills)
    } else {
      globalSkills.push(...skills)
    }

    textarea.value = ""
    updateSkillsDisplay(type)
  }
}

function removeSkill(type, index) {
  if (type === "agent") {
    agentSkills.splice(index, 1)
  } else {
    globalSkills.splice(index, 1)
  }
  updateSkillsDisplay(type)
}

function updateSkillsDisplay(type) {
  const displayArea = document.getElementById(`${type}SkillsDisplay`)
  const skillsArray = type === "agent" ? agentSkills : globalSkills
  const countElement = document.getElementById(`${type}SkillsCount`)

  // Update count
  countElement.textContent = `${skillsArray.length} skills`

  if (skillsArray.length === 0) {
    displayArea.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${type === "agent" ? "🤖" : "🌍"}</div>
                <p>No ${type} skills configured</p>
            </div>
        `
  } else {
    displayArea.innerHTML = `<div class="skills-list" id="${type}SkillsList"></div>`
    const skillsList = document.getElementById(`${type}SkillsList`)

    skillsArray.forEach((skill, index) => {
      const skillTag = document.createElement("div")
      skillTag.className = "skill-tag"
      skillTag.innerHTML = `
                ${escapeHtml(skill)}
                <span class="remove-skill" onclick="removeSkill('${type}', ${index})">×</span>
            `
      skillsList.appendChild(skillTag)
    })
  }
}

function updateAllDisplays() {
  updateTaskDisplay()
  updateSkillsDisplay("agent")
  updateSkillsDisplay("global")
  updatePipelineStepsDisplay()
}

async function loadAvailablePrompts() {
  const loadingIndicator = document.getElementById("pipelineLoading")
  loadingIndicator.style.display = "flex"

  try {
    const response = await fetch(`${BASE_URL}/prompts/steps`)
    const data = await response.json()

    if (data.status === "success") {
      // Extract unique prompt names
      const uniqueNames = [...new Set(data.data.map((step) => step.name))]
      availablePrompts = uniqueNames
      renderAvailablePrompts()
    } else {
      console.error("Failed to load prompts:", data.message)
      showPromptsError(`Failed to load prompts: ${data.message}`)
    }
  } catch (error) {
    console.error("Error loading prompts:", error)
    showPromptsError("Error loading prompts. Please check your connection and try again.")
  } finally {
    loadingIndicator.style.display = "none"
  }
}

function renderAvailablePrompts() {
  const container = document.getElementById("promptsContainer")
  container.innerHTML = ""

  if (availablePrompts.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h4>No prompts available</h4>
                <p>Add prompts to get started</p>
            </div>
        `
    return
  }

  availablePrompts.forEach((promptName) => {
    const promptElement = document.createElement("div")
    promptElement.className = "prompt-item"

    promptElement.innerHTML = `
            <div class="prompt-name">${escapeHtml(promptName)}</div>
            <button class="view-versions-btn" onclick="showPromptVersions('${escapeHtml(promptName)}')">
                View Versions
            </button>
        `

    container.appendChild(promptElement)
  })
}

async function showPromptVersions(promptName) {
  const modal = document.getElementById("promptVersionsModal")
  const title = document.getElementById("versionsModalTitle")
  const versionsList = document.getElementById("versionsList")
  const templateContent = document.getElementById("templateContent")
  const selectBtn = document.getElementById("selectVersionBtn")

  title.textContent = `${promptName} - Versions`
  versionsList.innerHTML = '<div class="mini-spinner"></div><span>Loading versions...</span>'
  templateContent.textContent = "Select a version to view its template"
  templateContent.className = "template-content"
  selectBtn.disabled = true
  selectedVersionId = null

  modal.style.display = "flex"

  try {
    const response = await fetch(`${BASE_URL}/prompts/${encodeURIComponent(promptName)}`)
    const data = await response.json()

    console.log("[v0] API Response:", data) // Debug log to see actual response structure

    if (response.ok && data.prompt_name && data.versions) {
      currentPromptVersions = data
      renderVersionsList(data.versions)

      // Auto-select latest version (first in list since they're sorted by date desc)
      if (data.versions.length > 0) {
        selectVersion(data.versions[0])
      }
    } else {
      console.log("[v0] Response not in expected format:", data) // Debug log
      versionsList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--accent-danger);">
          Failed to load versions: ${data.message || "Unexpected response format"}
        </div>
      `
    }
  } catch (error) {
    console.error("Error loading prompt versions:", error)
    versionsList.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--accent-danger);">
        Error loading versions. Please try again.
      </div>
    `
  }
}

function renderVersionsList(versions) {
  const versionsList = document.getElementById("versionsList")
  versionsList.innerHTML = ""

  versions.forEach((version, index) => {
    const versionElement = document.createElement("div")
    versionElement.className = "version-item"
    versionElement.onclick = (event) => selectVersion(version, event.currentTarget)

    const isLatest = index === 0
    const createdDate = new Date(version.created_at).toLocaleDateString()

    versionElement.innerHTML = `
      <div class="version-info">
        <div class="version-number">Version ${version.version}</div>
        <div class="version-date">${createdDate}</div>
      </div>
      ${isLatest ? '<span class="version-latest">Latest</span>' : ""}
    `

    versionsList.appendChild(versionElement)
  })
}

function selectVersion(version, eventTarget = null) {
  // Update UI selection
  document.querySelectorAll(".version-item").forEach((item) => {
    item.classList.remove("selected")
  })

  // Only try to add selected class if we have an event target
  if (eventTarget) {
    eventTarget.classList.add("selected")
  } else {
    // If called programmatically, find the version element by version ID
    const versionElements = document.querySelectorAll(".version-item")
    versionElements.forEach((element, index) => {
      if (currentPromptVersions && currentPromptVersions.versions[index].id === version.id) {
        element.classList.add("selected")
      }
    })
  }

  // Update template preview
  const templateContent = document.getElementById("templateContent")
  templateContent.textContent = version.template
  templateContent.className = "template-content has-content"

  // Store selected version
  selectedVersionId = version.id

  // Enable select button
  document.getElementById("selectVersionBtn").disabled = false
}

function selectPromptVersion() {
  if (!currentPromptVersions || !selectedVersionId) return

  const selectedVersion = currentPromptVersions.versions.find((v) => v.id === selectedVersionId)
  if (!selectedVersion) return

  // Add to selected steps
  const stepData = {
    name: currentPromptVersions.prompt_name,
    version_id: selectedVersionId,
    version: selectedVersion.version,
  }

  // Check if this prompt is already in the pipeline
  const existingIndex = selectedSteps.findIndex((step) => step.name === stepData.name)
  if (existingIndex !== -1) {
    // Replace existing step
    selectedSteps[existingIndex] = stepData
  } else {
    // Add new step
    selectedSteps.push(stepData)
  }

  updatePipelineStepsDisplay()
  hidePromptVersionsModal()
}

function hidePromptVersionsModal() {
  document.getElementById("promptVersionsModal").style.display = "none"
  currentPromptVersions = null
  selectedVersionId = null
}

function updatePipelineStepsDisplay() {
  const stepsArea = document.getElementById("pipelineStepsArea")
  const stepsCount = document.getElementById("stepsCount")

  stepsCount.textContent = `${selectedSteps.length} steps`

  if (selectedSteps.length === 0) {
    stepsArea.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚙️</div>
                <h4>No steps selected</h4>
                <p>Click on prompts from the left to add them as pipeline steps</p>
            </div>
        `
  } else {
    stepsArea.innerHTML = ""
    selectedSteps.forEach((step, index) => {
      const stepElement = document.createElement("div")
      stepElement.className = "pipeline-step"

      stepElement.innerHTML = `
                <div class="step-info">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-details">
                        <div class="step-name">${escapeHtml(step.name)}</div>
                        <div class="step-version">Version ${step.version}</div>
                    </div>
                </div>
                <button class="remove-step-btn" onclick="removeStep(${index})">Remove</button>
            `

      stepsArea.appendChild(stepElement)
    })
  }
}

function removeStep(index) {
  selectedSteps.splice(index, 1)
  updatePipelineStepsDisplay()
}

function showPromptsError(message) {
  const container = document.getElementById("promptsContainer")
  container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--accent-danger); background: rgba(239, 68, 68, 0.1); border-radius: 4px; border: 1px solid var(--accent-danger);">
            ${escapeHtml(message)}
        </div>
    `
}

async function refreshPipelineSteps() {
  const refreshBtn = document.querySelector(".refresh-btn")
  const refreshIcon = document.querySelector(".refresh-icon")
  const loadingIndicator = document.getElementById("pipelineLoading")

  // Show loading state
  refreshBtn.disabled = true
  refreshIcon.style.animation = "spin 1s linear infinite"
  loadingIndicator.style.display = "flex"

  // Clear current selections when refreshing
  selectedSteps = []

  await loadAvailablePrompts()

  // Restore button state and hide loading
  refreshBtn.disabled = false
  refreshIcon.style.animation = "none"
  loadingIndicator.style.display = "none"

  updatePipelineStepsDisplay()
}

// Modal functions
function showAddPromptModal() {
  document.getElementById("addPromptModal").style.display = "flex"
}

function hideAddPromptModal() {
  document.getElementById("addPromptModal").style.display = "none"
  document.getElementById("promptName").value = ""
  document.getElementById("promptContent").value = ""
}

async function saveNewPrompt() {
  const name = document.getElementById("promptName").value.trim()
  const template = document.getElementById("promptContent").value.trim()

  if (!name || !template) {
    alert("Please fill in both name and template fields.")
    return
  }

  try {
    const response = await fetch(`${BASE_URL}/prompts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, template }),
    })

    const result = await response.json()

    if (response.ok && result.status === "success") {
      hideAddPromptModal()
      alert("Prompt saved successfully!")
      // Refresh the prompts list
      await loadAvailablePrompts()
    } else {
      alert(`Failed to save prompt: ${result.message || "Unknown error"}`)
    }
  } catch (error) {
    console.error("Error saving prompt:", error)
    alert("Error saving prompt. Please check your connection and try again.")
  }
}

// Execution functions
function updateExecutionSummary() {
  document.getElementById("taskSummary").textContent = `${tasks.length} tasks`
  document.getElementById("agentSkillsSummary").textContent = `${agentSkills.length} skills`
  document.getElementById("globalSkillsSummary").textContent = `${globalSkills.length} skills`
  document.getElementById("stepsSummary").textContent = `${selectedSteps.length} steps`
}

function validateTranslationData() {
  const errors = []
  if (tasks.length === 0) {
    errors.push("Please add at least one task.")
  }
  if (selectedSteps.length === 0) {
    errors.push("Please select at least one pipeline step.")
  }
  return errors
}

function showValidationErrors(errors) {
  const errorContainer = document.getElementById("validationErrors")
  errorContainer.innerHTML = "<ul>" + errors.map((e) => `<li>${e}</li>`).join("") + "</ul>"
  errorContainer.style.display = "block"
}

function hideValidationErrors() {
  const errorContainer = document.getElementById("validationErrors")
  errorContainer.style.display = "none"
}

async function performTranslation() {
  hideValidationErrors()
  const validationErrors = validateTranslationData()
  if (validationErrors.length > 0) {
    showValidationErrors(validationErrors)
    return
  }

  const loadingOverlay = document.getElementById("loadingOverlay")
  const allInputsAndButtons = document.querySelectorAll("input, button, textarea")

  loadingOverlay.style.display = "flex"
  allInputsAndButtons.forEach((el) => (el.disabled = true))

  try {
    const requestBody = {
      task_list: tasks.join("\n"),
      agent_skills: agentSkills,
      global_skills: globalSkills,
      steps: selectedSteps.map((step) => ({
        name: step.name,
        version_id: step.version_id,
      })),
    }

    console.log("Sending translation request:", requestBody)

    const response = await fetch(`${BASE_URL}/translator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    const result = await response.json()
    lastTranslationResponse = result

    console.log("Translation response:", result)

    if (response.ok && result.status === "success") {
      renderResults(result.data)
      // Automatically switch to results tab
      document.querySelector('.tab-btn[data-tab="results"]').click()
    } else {
      const error = result.message || "An unknown error occurred."
      showValidationErrors(["API Error: " + error])
      document.querySelector('.tab-btn[data-tab="execute"]').click()
    }
  } catch (error) {
    console.error("Translation Error:", error)
    showValidationErrors(["A network or system error occurred. Please check the console for more details."])
    document.querySelector('.tab-btn[data-tab="execute"]').click()
  } finally {
    loadingOverlay.style.display = "none"
    allInputsAndButtons.forEach((el) => (el.disabled = false))
  }
}

function renderResults(data) {
  const resultsHeader = document.getElementById("resultsHeader")
  const statusIndicator = document.getElementById("statusIndicator")
  const resultsContent = document.getElementById("resultsContent")

  // Show header and clear previous results
  resultsHeader.style.display = "flex"
  resultsContent.innerHTML = ""

  // Update overall status
  statusIndicator.textContent = data.status
  statusIndicator.className = "status-indicator" // reset classes
  if (data.status === "success") {
    statusIndicator.classList.add("status-success")
  } else if (data.status === "completed_with_errors" || data.status === "failed") {
    statusIndicator.classList.add("status-failed")
  } else {
    statusIndicator.classList.add("status-incomplete")
  }

  if (!data.process_step || data.process_step.length === 0) {
    resultsContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h4>No steps were processed</h4>
                <p>The translation completed but no step results were returned</p>
            </div>
        `
    return
  }

  // Render each step
  data.process_step.forEach((step, index) => {
    const stepEl = document.createElement("div")
    stepEl.className = "step-result"

    const stepStatusClass = `status-${step.status.toLowerCase().replace(/\s+/g, "-")}`

    stepEl.innerHTML = `
            <div class="step-header">
                <span>${escapeHtml(step.step)}</span>
                <span class="status-indicator ${stepStatusClass}">${escapeHtml(step.status)}</span>
            </div>
            <div class="step-content">
                <div class="step-field">
                    <label>Input</label>
                    <div class="content">${step.input ? escapeHtml(step.input) : '<span style="color: var(--text-muted); font-style: italic;">No input provided</span>'}</div>
                </div>
                <div class="step-field">
                    <label>Output</label>
                    <div class="content">${step.output ? escapeHtml(step.output) : '<span style="color: var(--text-muted); font-style: italic;">No output generated</span>'}</div>
                </div>
                ${
                  step.prompt
                    ? `
                <div class="step-field">
                    <label>Prompt</label>
                    <div class="content">${escapeHtml(step.prompt)}</div>
                </div>
                `
                    : ""
                }
            </div>
        `
    resultsContent.appendChild(stepEl)
  })
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") {
    return String(unsafe)
  }
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function copyResults() {
  if (!lastTranslationResponse) {
    alert("No results to copy.")
    return
  }

  navigator.clipboard
    .writeText(JSON.stringify(lastTranslationResponse, null, 2))
    .then(() => {
      alert("Full response copied to clipboard!")
    })
    .catch((err) => {
      console.error("Failed to copy: ", err)
      alert("Could not copy results to clipboard.")
    })
}

// Allow Enter key to add tasks and skills
document.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    if (e.target.id === "tasksBulk") {
      // Allow normal Enter behavior in textarea
      return
    } else if (e.target.id === "agentSkillsBulk" || e.target.id === "globalSkillsBulk") {
      // Allow normal Enter behavior in textarea
      return
    }
  }
})
