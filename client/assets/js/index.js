const API_URL = '/';
const converter = new showdown.Converter();
let promptToRetry = null;
let uniqueIdToRetry = null;

const submitButton = document.getElementById('submit-button');
const regenerateResponseButton = document.getElementById('regenerate-response-button');
const promptInput = document.getElementById('prompt-input');
const modelSelect = document.getElementById('model-select');
const responseList = document.getElementById('response-list');
const fileInput = document.getElementById("whisper-file");
let token = '';

modelSelect.addEventListener("change", function() {
    if (modelSelect.value === "whisper") {
        fileInput.style.display = "block";
        // Disable the input field when Whisper is selected
        promptInput.style.display = 'none';
    } else {
        fileInput.style.display = "none";
        // Enable the input field when Whisper is not selected
        promptInput.style.display = 'block';
    }
});

let isGeneratingResponse = false;

let loadInterval = null;

promptInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (event.ctrlKey || event.shiftKey) {
            document.execCommand('insertHTML', false, '<br/><br/>');
        } else {
            // getGPTResult();
            getHotels();
        }
    }
});

function generateUniqueId() {
    const timestamp = Date.now();
    const randomNumber = Math.random();
    const hexadecimalString = randomNumber.toString(16);

    return `id-${timestamp}-${hexadecimalString}`;
}


function addResponse(selfFlag, prompt) {
    const uniqueId = generateUniqueId();
    const html = `
            <div class="response-container ${selfFlag ? 'my-question' : 'chatgpt-response'}">
                <img class="avatar-image" style=${selfFlag ? "margin-left:15px":"margin-right:15px"} src="assets/img/${selfFlag ? 'me' : 'chatgpt'}.png" alt="avatar"/>
                <div class="prompt-content" id="${uniqueId}">${prompt}</div>
            </div>
        `
    responseList.insertAdjacentHTML('beforeend', html);
    responseList.scrollTop = responseList.scrollHeight;
    return uniqueId;
}

function loader(element) {
    element.textContent = ''

    loadInterval = setInterval(() => {
        // Update the text content of the loading indicator
        element.textContent += '.';

        // If the loading indicator has reached three dots, reset it
        if (element.textContent === '....') {
            element.textContent = '';
        }
        if (!isGeneratingResponse) {
            // element.textContent = ''
            return;   
        }
    }, 300);
}

function setErrorForResponse(element, message) {
    element.innerHTML = message;
    element.style.color = 'rgb(200, 0, 0)';
}

function setRetryResponse(prompt, uniqueId) {
    promptToRetry = prompt;
    uniqueIdToRetry = uniqueId;
    regenerateResponseButton.style.display = 'flex';
}

async function regenerateGPTResult() {
    try {
        // await getGPTResult(promptToRetry, uniqueIdToRetry)
        regenerateResponseButton.classList.add("loading");
    } finally {
        regenerateResponseButton.classList.remove("loading");
    }
}

async function getToken() {
    try {
        const response = await fetch("/token");
        const jsonData = await response.json(); // Convert the response body to JSON format
        token = jsonData.token;
        // Do something with jsonData, e.g., update UI or perform further operations.
    } catch (e) {
        console.error(e);
        // Handle errors if needed
    }
}

async function getHotels(_promptToRetry, _uniqueIdToRetry) {
    const prompt = _promptToRetry ?? promptInput.textContent;
    // if (prompt.includes("Berlin") && prompt.includes("hotel")) {
    //     getHotels()
    // }
    // If a response is already being generated or the prompt is empty, return
    if (isGeneratingResponse || !prompt) {
        return;
    }

    // Add loading class to the submit button
    submitButton.classList.add("loading");

    // Clear the prompt input
    promptInput.textContent = '';

    if (!_uniqueIdToRetry) {
        // Add the prompt to the response list
        addResponse(true, `<div>${prompt}</div>`);
    }

    // Get a unique ID for the response element
    const uniqueId = _uniqueIdToRetry ?? addResponse(false);

    // Get the response element
    const responseElement = document.getElementById(uniqueId);

    // Show the loader
    loader(responseElement);

    // Set isGeneratingResponse to true
    isGeneratingResponse = true;

    try {
        const model = modelSelect.value;
        // Send a POST request to the API with the prompt in the request body
        const response = await fetch("/hotels", {
            headers: { 'auth-token': token, 'supplierId': 9887 }
        });
        if (!response.ok) {
            setRetryResponse(prompt, uniqueId);
            setErrorForResponse(responseElement, `HTTP Error: ${await response.text()}`);
            return;
        }
        const jsonData = await response.json(); // Convert the response body to JSON format
        var hotel = jsonData.hotel
        var responseText = "";
        console.log(jsonData.hotel)
        if(hotel.length > 5) {
            for(var i = 0; i < 5; i++) {
                responseText += hotel[i].hotelname + " is located in " + hotel[i].address.locationName + ".\n";
                // responseText += "You can contact to " + hotel[i].address.phone + " or " + hotel[i].email + ".\n";
                console.log(responseText);
            }
        }
        // Set the response text
        responseElement.innerHTML = converter.makeHtml(responseText.trim());

        promptToRetry = null;
        uniqueIdToRetry = null;
        regenerateResponseButton.style.display = 'none';
        isGeneratingResponse = false;
        submitButton.classList.remove("loading");
        setTimeout(() => {
            clearInterval(loadInterval)
            // Scroll to the bottom of the response list
            responseList.scrollTop = responseList.scrollHeight;
            hljs.highlightAll();
        }, 10);
    } catch (err) {
        setRetryResponse(prompt, uniqueId);
        // If there's an error, show it in the response element
        setErrorForResponse(responseElement, `Error: ${err.message}`);
    }
}

async function getWhisperResult() {
    if (!fileInput.files?.length) {
        return;
    }
    const formData = new FormData();
    formData.append("audio", fileInput.files[0]);
    const uniqueId = addResponse(false);
    const responseElement = document.getElementById(uniqueId);
    isGeneratingResponse = true;
    loader(responseElement);

    try {
        submitButton.classList.add("loading");
        const response = await fetch("/transcribe", {
            method: "POST",
            body: formData
        });
        if (!response.ok) {
            setErrorForResponse(responseElement, `HTTP Error: ${await response.text()}`);
            return;
        }
        const responseText = await response.text();
        responseElement.innerHTML = `<div>${responseText}</div>`
    } catch (e) {
        console.log(e);
        setErrorForResponse(responseElement, `Error: ${e.message}`);
    } finally {
        isGeneratingResponse = false;
        submitButton.classList.remove("loading");
        clearInterval(loadInterval);
    }
}

// Function to get GPT result
async function getGPTResult(_promptToRetry, _uniqueIdToRetry) {
    if (modelSelect.value === 'whisper') {
        await getWhisperResult();
        return;
    }
    // Get the prompt input
    const prompt = _promptToRetry ?? promptInput.textContent;
    if (prompt.includes("Berlin") && prompt.includes("hotel")) {
        getHotels()
    }
    // If a response is already being generated or the prompt is empty, return
    if (isGeneratingResponse || !prompt) {
        return;
    }

    // Add loading class to the submit button
    submitButton.classList.add("loading");

    // Clear the prompt input
    promptInput.textContent = '';

    if (!_uniqueIdToRetry) {
        // Add the prompt to the response list
        addResponse(true, `<div>${prompt}</div>`);
    }

    // Get a unique ID for the response element
    const uniqueId = _uniqueIdToRetry ?? addResponse(false);

    // Get the response element
    const responseElement = document.getElementById(uniqueId);

    // Show the loader
    loader(responseElement);

    // Set isGeneratingResponse to true
    isGeneratingResponse = true;

    try {
        const model = modelSelect.value;
        // Send a POST request to the API with the prompt in the request body
        const response = await fetch(API_URL + 'get-prompt-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                model
            })
        });
        if (!response.ok) {
            setRetryResponse(prompt, uniqueId);
            setErrorForResponse(responseElement, `HTTP Error: ${await response.text()}`);
            return;
        }
        const responseText = await response.text();
        if (model === 'image') {
            // Show image for `Create image` model
            responseElement.innerHTML = `<img src="${responseText}" class="ai-image" alt="generated image"/>`
        } else {
            // Set the response text
            responseElement.innerHTML = converter.makeHtml(responseText.trim());
        }

        promptToRetry = null;
        uniqueIdToRetry = null;
        regenerateResponseButton.style.display = 'none';
        setTimeout(() => {
            // Scroll to the bottom of the response list
            responseList.scrollTop = responseList.scrollHeight;
            hljs.highlightAll();
        }, 10);
    } catch (err) {
        setRetryResponse(prompt, uniqueId);
        // If there's an error, show it in the response element
        setErrorForResponse(responseElement, `Error: ${err.message}`);
    } finally {
        // Set isGeneratingResponse to false
        isGeneratingResponse = false;

        // Remove the loading class from the submit button
        submitButton.classList.remove("loading");

        // Clear the loader interval
        clearInterval(loadInterval);
    }
}

submitButton.addEventListener("click", () => {
    // getGPTResult();
    getHotels();
});
regenerateResponseButton.addEventListener("click", () => {
    regenerateGPTResult();
});

document.addEventListener("DOMContentLoaded", function(){
    promptInput.focus();
});

getToken()