window.onload = function() {
    fetchDevices();
};

function fetchDevices() {
    fetch('/api/devices')
    .then(response => response.json())
    .then(devices => {
        const deviceList = document.getElementById('deviceList');
        deviceList.innerHTML = '';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device;
            option.textContent = device;
            deviceList.appendChild(option);
        });
    });
}

function sendCommand() {
    const device = document.getElementById('deviceList').value;
    const command = document.getElementById('commandInput').value;

    fetch('/api/send-command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            device: device,
            command: command
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            alert('Command sent successfully!');
        } else {
            alert('Failed to send command.');
        }
    });
}

function refreshDeviceList(devices) {
    const deviceList = document.getElementById('deviceList');
    deviceList.innerHTML = ""; // clear the list
    
    if (devices.length === 0) {
        const li = document.createElement('li');
        li.textContent = "No devices connected.";
        deviceList.appendChild(li);
    } else {
        devices.forEach(device => {
            const li = document.createElement('li');
            li.textContent = device;
            deviceList.appendChild(li);
        });
    }
}

