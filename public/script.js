// public/script.js
let selectedDevice = null;

// Fetch the list of connected devices and update the UI
function fetchDevices() {
    fetch('/devices/status')
        .then(response => response.json())
        .then(data => {
            const deviceList = document.getElementById('deviceList');
            deviceList.innerHTML = '';
            for (const device in data) {
                if (data[device].status === 'online') {
                    const listItem = document.createElement('li');
                    listItem.textContent = device;
                    listItem.onclick = function() {
                        selectedDevice = device;
                        listItem.style.backgroundColor = 'lightblue';
                    };
                    deviceList.appendChild(listItem);
                }
            }
        });
}

// Send a command to the selected device
function sendCommand() {
    const commandInput = document.getElementById('commandInput');
    const message = document.getElementById('message');
    if (selectedDevice) {
        fetch('/api/send-command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device: selectedDevice,
                command: commandInput.value
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                message.textContent = 'Command sent successfully!';
            } else {
                message.textContent = data.message;
            }
            commandInput.value = '';
        });
    } else {
        message.textContent = 'Please select a device first.';
    }
}

// Fetch the devices every 1 seconds
setInterval(fetchDevices, 1000);
