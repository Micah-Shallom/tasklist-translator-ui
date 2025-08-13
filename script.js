 <script>
        // Global variables
        let tasks = [];
        let agentSkills = [];
        let globalSkills = [];
        let availableSteps = [];
        let selectedSteps = [];
        let lastTranslationResponse = null;

        // Base URL - modify this to match your API
        const BASE_URL = 'http://localhost:8080/api/v1'; // Change this to your API URL

        // Tab functionality
        document.addEventListener('DOMContentLoaded', function() {
            initializeTabs();
            loadPipelineSteps();
            addTask(); // Add initial empty task
        });

        function initializeTabs() {
            const tabBtns = document.querySelectorAll('.tab-btn');
            const tabContents = document.querySelectorAll('.tab-content');

            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetTab = btn.getAttribute('data-tab');
                    
                    // Remove active class from all tabs and contents
                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    
                    // Add active class to clicked tab and corresponding content
                    btn.classList.add('active');
                    document.getElementById(`${targetTab}-tab`).classList.add('active');
                    
                    // Update summaries when switching to execute tab
                    if (targetTab === 'execute') {
                        updateExecutionSummary();
                    }
                });
            });
        }

        // Task management functions
        function addTask() {
            const taskList = document.getElementById('taskList');
            const taskIndex = tasks.length;
            
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.innerHTML = `
                <input type="text" placeholder="Enter task description..." 
                       onchange="updateTask(${taskIndex}, this.value)" 
                       onkeyup="updateTask(${taskIndex}, this.value)">
                <button class="remove-task-btn" onclick="removeTask(${taskIndex})">Remove</button>
            `;
            
            taskList.appendChild(taskItem);
            tasks.push('');
        }

        function removeTask(index) {
            tasks.splice(index, 1);
            renderTasks();
        }

        function updateTask(index, value) {
            if (index < tasks.length) {
                tasks[index] = value;
            }
        }

        function renderTasks() {
            const taskList = document.getElementById('taskList');
            taskList.innerHTML = '';
            
            tasks.forEach((task, index) => {
                const taskItem = document.createElement('div');
                taskItem.className = 'task-item';
                taskItem.innerHTML = `
                    <input type="text" value="${task}" placeholder="Enter task description..." 
                           onchange="updateTask(${index}, this.value)" 
                           onkeyup="updateTask(${index}, this.value)">
                    <button class="remove-task-btn" onclick="removeTask(${index})">Remove</button>
                `;
                taskList.appendChild(taskItem);
            });
        }

        // Skills management functions
        function addSkill(type) {
            const input = document.getElementById(`${type}SkillInput`);
            const skill = input.value.trim();
            
            if (skill) {
                if (type === 'agent') {
                    agentSkills.push(skill);
                } else {
                    globalSkills.push(skill);
                }
                
                input.value = '';
                renderSkills(type);
            }
        }

        function addSkillsBulk(type) {
            const textarea = document.getElementById(`${type}SkillsBulk`);
            const skills = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
            
            if (skills.length > 0) {
                if (type === 'agent') {
                    agentSkills.push(...skills);
                } else {
                    globalSkills.push(...skills);
                }
                
                textarea.value = '';
                renderSkills(type);
            }
        }

        function removeSkill(type, index) {
            if (type === 'agent') {
                agentSkills.splice(index, 1);
            } else {
                globalSkills.splice(index, 1);
            }
            renderSkills(type);
        }

        function renderSkills(type) {
            const container = document.getElementById(`${type}Skills`);
            const skillsArray = type === 'agent' ? agentSkills : globalSkills;
            
            container.innerHTML = '';
            
            skillsArray.forEach((skill, index) => {
                const skillTag = document.createElement('div');
                skillTag.className = 'skill-tag';
                skillTag.innerHTML = `
                    ${skill}
                    <span class="remove-skill" onclick="removeSkill('${type}', ${index})">×</span>
                `;
                container.appendChild(skillTag);
            });
        }

        // Pipeline steps functions
        async function loadPipelineSteps() {
            try {
                const response = await fetch(`${BASE_URL}/prompts/steps`);
                const data = await response.json();
                
                if (data.status === 'success') {
                    availableSteps = data.data;
                    renderPipelineSteps();
                } else {
                    console.error('Failed to load pipeline steps:', data.message);
                }
            } catch (error) {
                console.error('Error loading pipeline steps:', error);
            }
            
            // Hide loading indicator
            document.getElementById('pipelineLoading').style.display = 'none';
        }

        function renderPipelineSteps() {
            const container = document.getElementById('pipelineSteps');
            container.innerHTML = '';
            
            availableSteps.forEach(step => {
                const stepCard = document.createElement('div');
                stepCard.className = 'step-card';
                stepCard.onclick = () => toggleStep(step);
                
                if (selectedSteps.some(s => s.id === step.id)) {
                    stepCard.classList.add('selected');
                }
                
                stepCard.innerHTML = `
                    <h4>${step.name}</h4>
                    <p>Version ${step.version}</p>
                    <p>Created: ${new Date(step.created_at).toLocaleDateString()}</p>
                `;
                
                container.appendChild(stepCard);
            });
        }

        function toggleStep(step) {
            const index = selectedSteps.findIndex(s => s.id === step.id);
            
            if (index === -1) {
                selectedSteps.push(step);
            } else {
                selectedSteps.splice(index, 1);
            }
            
            renderPipelineSteps();
            renderPipelineOrder();
        }

        function renderPipelineOrder() {
            const container = document.getElementById('orderList');
            
            if (selectedSteps.length === 0) {
                container.innerHTML = '<p class="empty-order">No steps selected</p>';
                return;
            }
            
            container.innerHTML = '';
            
            selectedSteps.forEach((step, index) => {
                const orderItem = document.createElement('div');
                orderItem.className = 'order-item';
                orderItem.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="order-number">${index + 1}</div>
                        <span>${step.name}</span>
                    </div>
                    <button onclick="removeFromOrder(${index})" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Remove</button>
                `;
                container.appendChild(orderItem);
            });
        }

        function removeFromOrder(index) {
            selectedSteps.splice(index, 1);
            renderPipelineSteps();
            renderPipelineOrder();
        }

        // Execution functions
        function updateExecutionSummary() {
            document.getElementById('taskSummary').textContent = `${tasks.filter(t => t.trim()).length} tasks`;
            document.getElementById('agentSkillsSummary').textContent = `${agentSkills.length} skills`;
            document.getElementById('globalSkillsSummary').textContent = `${globalSkills.length} skills`;
            document.getElementById('stepsSummary').textContent = `${selectedSteps.length} steps`;
        }

        async function performTranslation() {
            // Validation
            const validationErrors = validateTranslationData();
            if (validationErrors.length > 0) {
                showValidationErrors(validationErrors);
                return;
            }