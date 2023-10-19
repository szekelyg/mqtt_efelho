// public/script.js
let selectedDevice = null;

function deselectAllDevices() {
    const deviceBoxes = document.querySelectorAll('.deviceBox');
    deviceBoxes.forEach(box => box.classList.remove('selected'));
}

// Fetch the list of connected devices and update the UI
function fetchDevices() {
    fetch('/devices/status')
        .then(response => response.json())
        .then(data => {
            const deviceContainer = document.getElementById('deviceContainer');
            deviceContainer.innerHTML = '';
            for (const device in data) {
                if (data[device].status === 'online') {
                    const deviceBox = document.createElement('div');
                    deviceBox.className = 'deviceBox';
                    deviceBox.textContent = device;
                    deviceBox.onclick = function() {
                        deselectAllDevices();
                        selectedDevice = this.textContent; // Frissítjük a selectedDevice változót a kijelölt eszköz nevére
                        deviceBox.classList.add('selected');
                    };
                    deviceContainer.appendChild(deviceBox);
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

// Fetch the devices every 10 seconds
setInterval(fetchDevices, 10000);
