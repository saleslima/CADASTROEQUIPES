import { initializeApp } from 'firebase/app';
// Import 'get' for one-time data fetching
import { getDatabase, ref, push, set, onValue, remove, update, get } from 'firebase/database';

// Provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-U3nYN7M_NpW7bvaqE9BT_--o7RfBcqY",
  authDomain: "controle-gastos-9539d.firebaseapp.com",
  databaseURL: "https://controle-gastos-9539d-default-rtdb.firebaseio.com",
  projectId: "controle-gastos-9539d",
  storageBucket: "controle-gastos-9539d.firebasestorage.app",
  messagingSenderId: "538009752360",
  appId: "1:538009752360:web:5be290d4183fc5e886361d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const usersRef = ref(database, 'usuarios'); // Reference to the 'usuarios' node

// DOM Elements
const form = document.getElementById('military-form');
const firebaseKeyInput = document.getElementById('firebase-key');
const equipeSelect = document.getElementById('equipe'); // Added equipe select
const postoGraduacaoSelect = document.getElementById('posto-graduacao');
const nomeGuerraInput = document.getElementById('nome-guerra');
const reInput = document.getElementById('re');
const dataPromocaoInput = document.getElementById('data-promocao');
const senhaInput = document.getElementById('senha');
const submitButton = document.getElementById('submit-button');
const cancelEditButton = document.getElementById('cancel-edit');
const rankingTableBody = document.getElementById('ranking-table-body');
const searchReInput = document.getElementById('search-re'); // Get the new search input

// Store all users data retrieved from Firebase globally or in a scope accessible by search
let allUsersGlobal = [];

// Define the rank hierarchy for sorting (higher index = lower rank)
// This determines the automatic sort order.
const rankHierarchy = [
    "Coronel", "Tenente-Coronel", "Major", "Capitão",
    "1º Tenente", "2º Tenente", "Aspirante", "Subtenente",
    "1º Sargento", "2º Sargento", "3º Sargento", "Cabo", "Soldado", "Soldado 2ª Classe"
];

// Function to get the sorting value of a rank
function getRankSortValue(rank) {
    const index = rankHierarchy.indexOf(rank);
    // If rank not found, put it at the end (or handle error)
    return index === -1 ? rankHierarchy.length : index;
}

// --- CRUD Operations ---

// Create/Update Data
form.addEventListener('submit', async (e) => { // Make the event listener async to use await inside
    e.preventDefault();

    const key = firebaseKeyInput.value;
    const equipe = equipeSelect.value; // Get equipe value
    const postoGraduacao = postoGraduacaoSelect.value; // Value uses the full name
    const nomeGuerra = nomeGuerraInput.value.toUpperCase(); // Convert to uppercase
    const re = parseInt(reInput.value, 10);
    const dataPromocaoValue = dataPromocaoInput.value; // Get value from date input
    const senha = senhaInput.value.toUpperCase(); // Convert to uppercase

    // Basic validation for required fields (Equipe, P/G, Nome de Guerra, RE, Senha)
    if (!equipe || !postoGraduacao || !nomeGuerra || isNaN(re) || !senha) {
        alert('Por favor, preencha os campos obrigatórios (Equipe, P/G, Nome de Guerra, RE, Senha).');
        return;
    }

    // Fetch all users for validation checks
    // We can use the globally available allUsersGlobal array if it's already populated by onValue,
    // but fetching fresh data guarantees the most current state for validation.
    // Let's fetch fresh data for crucial validation steps.
    let currentAllUsersData = null;
    try {
        const snapshot = await get(usersRef);
        currentAllUsersData = snapshot.val();
    } catch (error) {
        console.error("Erro ao buscar usuários para validação: ", error);
        alert('Erro ao verificar dados existentes para validação. Tente novamente.');
        return;
    }

    const existingUsersArray = [];
    if (currentAllUsersData) {
         for (const userKey in currentAllUsersData) {
            existingUsersArray.push({
                key: userKey,
                ...currentAllUsersData[userKey]
            });
        }
    }

    // ** Validation Logic 1: Data Promoção mandatory if same rank exists (except Soldado/Sd 2ª Cl) **
    try {
        const usersWithSameRank = existingUsersArray.filter(user =>
            // Exclude the user being edited from the check for "other" users with the same rank
            user.key !== key && user.postoGraduacao === postoGraduacao
        );

        const isSoldadoRank = postoGraduacao === "Soldado" || postoGraduacao === "Soldado 2ª Classe";

        // Condition: Not a Soldado rank AND there are other users with the exact same rank AND Data Promoção is empty
        if (!isSoldadoRank && usersWithSameRank.length > 0 && !dataPromocaoValue) {
             alert('A Data Promoção é obrigatória para esta P/G, pois já existem outros militares com a mesma graduação. Informe a data mais antiga para determinar a precedência.');
             return; // Stop the submission
        }

    } catch (error) {
        console.error("Erro ao verificar usuários existentes para validação (Data Promoção): ", error);
        // Allow submission if validation check itself fails, but log the error.
        // Consider making this a hard stop depending on security requirements.
        // For now, it logs but proceeds if the check fails unexpectedly.
    }
    // ** End Validation Logic 1 **

    // ** Validation Logic 2: RE must be unique across all users **
    try {
        const existingUserWithSameRE = existingUsersArray.find(user =>
            // Check if any *other* user has the same RE
            user.key !== key && user.re === re
        );

        if (existingUserWithSameRE) {
            alert(`O RE ${re} já está cadastrado para o militar ${existingUserWithSameRE.nomeGuerra} (${existingUserWithSameRE.postoGraduacao}). Um RE só pode pertencer a um militar.`);
            return; // Stop the submission
        }

    } catch (error) {
        console.error("Erro ao verificar RE existente: ", error);
        // Allow submission if validation check itself fails, but log the error.
    }
    // ** End Validation Logic 2 **


    // Store date as a string in 'YYYY-MM-DD' format, or null if empty
    const newDataPromocao = dataPromocaoValue || null;


    const userData = {
        equipe, // Add equipe to data
        postoGraduacao,
        nomeGuerra,
        re,
        dataPromocao: newDataPromocao, // Store the date string or null
        senha // WARNING: Storing plaintext passwords! Consider hashing in a real application.
    };

    try {
        if (key) {
            // Update existing record
            await update(ref(database, `usuarios/${key}`), userData);
            alert('Militar atualizado com sucesso!');

        } else {
            // Create new record
            const newUserRef = push(usersRef);
            await set(newUserRef, userData);
            alert('Militar cadastrado com sucesso!');
        }

        resetForm();

    } catch (error) {
        console.error("Erro ao salvar militar: ", error);
        alert('Erro ao salvar militar.');
    }
});

// Delete Data
function deleteUser(key) {
    if (confirm('Tem certeza que deseja excluir este militar?')) {
        const userRef = ref(database, `usuarios/${key}`);
        remove(userRef)
            .then(() => {
                alert('Militar excluído com sucesso!');
                // List will automatically update via onValue listener
            })
            .catch((error) => {
                console.error("Erro ao excluir militar: ", error);
                alert('Erro ao excluir militar.');
            });
    }
}

// Populate form for Editing
function editUser(key, userData) {
    firebaseKeyInput.value = key;
    equipeSelect.value = userData.equipe || ''; // Set equipe value, default to empty
    postoGraduacaoSelect.value = userData.postoGraduacao; // Use the full name value
    nomeGuerraInput.value = userData.nomeGuerra;
    reInput.value = userData.re;
    // Set the date input value, default to empty string if null/undefined
    dataPromocaoInput.value = userData.dataPromocao || '';
    senhaInput.value = userData.senha;

    submitButton.textContent = 'Atualizar';
    cancelEditButton.style.display = 'inline-block';

    // Scroll to the form section
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Cancel Edit
cancelEditButton.addEventListener('click', resetForm);

function resetForm() {
    firebaseKeyInput.value = '';
    form.reset();
    submitButton.textContent = 'Cadastrar';
    cancelEditButton.style.display = 'none';
    // Clear the search input as well
    searchReInput.value = '';
}

// --- Read Data and Display Ranking ---

onValue(usersRef, (snapshot) => {
    const usersData = snapshot.val();
    const usersArray = [];

    if (usersData) {
        // Convert Firebase object to array
        for (const key in usersData) {
            usersArray.push({
                key,
                ...usersData[key]
            });
        }

        // Store all users globally for search functionality
        allUsersGlobal = usersArray;


        // Sort the array based on:
        // 1. Posto/Graduação (higher rank first)
        // 2. Data Promoção (older date first, entries without date last)
        // 3. RE (lower RE prevails)
        // Equipe is NOT used for sorting based on previous instructions.
        usersArray.sort((a, b) => {
            // 1. Sort by Posto/Graduação (higher rank first)
            const rankAValue = getRankSortValue(a.postoGraduacao);
            const rankBValue = getRankSortValue(b.postoGraduacao);

            if (rankAValue < rankBValue) {
                return -1; // a comes before b (higher rank)
            }
            if (rankAValue > rankBValue) {
                return 1; // b comes before a (lower rank)
            }

            // 2. If ranks are the same, sort by Data Promoção (older date first)
            const dateA = a.dataPromocao;
            const dateB = b.dataPromocao;

            // Handle cases where date is null or empty string: non-null/non-empty comes first
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            if (dateA && dateB) {
                 // Compare dates as strings (assuming YYYY-MM-DD format for correct lexicographical sort)
                if (dateA < dateB) {
                    return -1; // older date comes first
                }
                if (dateA > dateB) {
                    return 1; // newer date comes later
                }
                 // If dates are the same, continue to compare RE
            }
             // If both dates are null/empty, continue to compare RE

            // 3. If ranks AND dates are the same (or neither has date), sort by RE (lower RE prevails)
            const reA = parseInt(a.re, 10);
            const reB = parseInt(b.re, 10);

            if (reA < reB) {
                return -1; // lower RE comes first
            }
            if (reA > reB) {
                return 1; // higher RE comes later
            }

            return 0; // objects are equal based on all criteria
        });

        // Limit to top 150 for display
        const topUsers = usersArray.slice(0, 150);

        // Display the ranking
        displayRanking(topUsers);

    } else {
        // No data
        allUsersGlobal = []; // Clear global data
        displayRanking([]);
    }
}, (error) => {
    console.error("Erro ao carregar dados do Firebase: ", error);
    // Adjust colspan for the new column
    rankingTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Erro ao carregar dados.</td></tr>';
});

function displayRanking(users) {
    rankingTableBody.innerHTML = ''; // Clear current list

    if (users.length === 0) {
        // Adjust colspan for the new column
        rankingTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum militar cadastrado ou no ranking.</td></tr>';
        return;
    }

    users.forEach((user, index) => {
        const row = document.createElement('tr');
        // Display the calculated rank based on the sort order
        const displayedRank = index + 1;

        row.innerHTML = `
            <td>${displayedRank}º</td>
            <td>${user.equipe || ''}</td> <!-- Display Equipe -->
            <td>${user.postoGraduacao}</td>
            <td>${user.nomeGuerra}</td>
            <td>${user.re}</td>
            <td>${user.dataPromocao || ''}</td> <!-- Display Data Promoção or empty -->
            <td>
                <button class="edit-btn" data-key="${user.key}">Editar</button>
                <button class="delete-btn" data-key="${user.key}">Excluir</button>
            </td>
        `;
        rankingTableBody.appendChild(row);
    });

    // Add event listeners to new buttons (delegation might be more efficient for large lists)
    rankingTableBody.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            // Find the user data in the global array (more efficient than fetching again)
            const userToEdit = allUsersGlobal.find(user => user.key === key);
            if (userToEdit) {
                 editUser(key, userToEdit);
            } else {
                console.error("User data not found in local array for key:", key);
                alert("Erro ao carregar dados do militar para edição.");
            }
        });
    });

     rankingTableBody.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            deleteUser(key);
        });
    });
}

// --- Search Functionality ---

searchReInput.addEventListener('input', (e) => {
    const searchTerm = parseInt(e.target.value, 10);

    // If search term is empty or not a valid number, reset form and do nothing else
    if (isNaN(searchTerm)) {
        resetForm();
        return;
    }

    // Find the user with the matching RE in the global list
    const foundUser = allUsersGlobal.find(user => user.re === searchTerm);

    if (foundUser) {
        // If user is found, populate the form for editing
        editUser(foundUser.key, foundUser);
        // Optionally, you could highlight the user in the list, but the prompt didn't ask for that.
        // Clearing the search input after finding/populating might be a good UX choice,
        // but the prompt implies it stays there to show the searched RE.
    } else {
        // If user is not found, clear the form fields but keep the search term
        // Do not reset the form entirely as it would clear the search input
        firebaseKeyInput.value = '';
        equipeSelect.value = '';
        postoGraduacaoSelect.value = '';
        nomeGuerraInput.value = '';
        reInput.value = ''; // Clear the RE field in the form to avoid confusion
        dataPromocaoInput.value = '';
        senhaInput.value = '';
        submitButton.textContent = 'Cadastrar'; // Switch back to "Cadastrar" mode
        cancelEditButton.style.display = 'none';

        // Optionally provide feedback that the RE was not found
        // console.log(`RE ${searchTerm} não encontrado.`);
    }
});