'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const $ = document;
const form = $.querySelector('.form');
const containerWorkouts = $.querySelector('.workouts');
const inputType = $.querySelector('.form__input--type');
const inputDistance = $.querySelector('.form__input--distance');
const inputDuration = $.querySelector('.form__input--duration');
const inputCadence = $.querySelector('.form__input--cadence');
const inputElevation = $.querySelector('.form__input--elevation');
const btnDeleteAll = $.querySelector('.trash-icon');
const btnLocate = $.querySelector('.locate-icon');
const btnMap = $.querySelector('.map-icon');


class App {
  #map;
  #mapZoomLevel = 17;
  #mapEvent;

  #markers = [];
  #polylines = [];

  workouts = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // make the edit and del btn option for previos workout
    this._editWorkout();
    this._deleteWorkout();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this)); //cz
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    btnDeleteAll.addEventListener('click', this._deleteAllWorkout.bind(this));
    btnMap.addEventListener('click', this._fitMapToAllMarkers.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Add marker to current position
    const customMarker = L.icon({
      iconUrl: 'leaf-marker.png',
      iconSize: [38, 45],
    });

    L.marker([position.coords.latitude, position.coords.longitude], {
      icon: customMarker,
    })
      .addTo(this.#map)
      .bindPopup("You're Here")
      .openPopup();

    this.workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    this._drawLines(this.workouts);
  }

  _drawLines(workouts) {
    const latlngs = [[], []];

    workouts.forEach(workout =>
      latlngs[workout.type === 'running' ? 0 : 1].push(workout.coords)
    );

    // create a red polyline from an array of LatLng points
    const polyline = L.polyline(latlngs, { color: 'red' }).addTo(this.#map);
    this.#polylines.push(polyline);
  }

  _fitMapToAllMarkers() {
    var featureGroup = L.featureGroup(this.#markers).addTo(this.#map);
    this.#map.fitBounds(featureGroup.getBounds());
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // draw line
    this._drawLines(this.workouts);

    // Set local storage to all workouts
    this._setLocalStorage();

    // make the edit and del btn option for new workout
    this._editWorkout();
    this._deleteWorkout();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__edit-del">
          <p class="workout__edit">Edit</p>
          <p class="workout__del">Delete</p>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    if (!workout) return;
    else {
      this.#map.setView(workout.coords, this.#mapZoomLevel, {
        animate: true,
        pan: {
          duration: 1,
        },
      });
    }
  }

  _editWorkout() {
    // get all the edit btn elements
    const BtnEditWorkout = document.querySelectorAll('.workout__edit');

    // set click event to edit btn
    BtnEditWorkout.forEach(btn => {
      btn.addEventListener('click', e => {
        // get the id of workout
        const workoutID = e.target.closest('.workout').dataset.id;

        // get the workout in data with ID
        const workoutObj = this.workouts.find(wo => wo.id == workoutID);

        // get the position(index) of workout in data
        const workoutindex = this.workouts.indexOf(workoutObj);

        // get data from user to replace
        const distancep = +prompt('Enter your distance(only Number) :');
        const durationp = +prompt('Enter your duration(only Number) :');
        const cadencep =
          this.workouts[workoutindex].type === 'running'
            ? +prompt('Enter your cadence(only Number) :')
            : +prompt('Enter your elevation(only Number) :');

        // replace the user's data to current copy data
        workoutObj.distance = distancep;
        workoutObj.duration = durationp;
        workoutObj.type === 'running' //condition
          ? (workoutObj.cadence = cadencep)
          : (workoutObj.elevation = elevationp);

        // replace copy data to orginal
        this.workouts[workoutindex] = workoutObj;

        // remove all the previose workout, except first
        while (containerWorkouts.children.length > 1) {
          containerWorkouts.removeChild(containerWorkouts.lastChild);
        }

        // render the workouts again after deleting
        this.workouts.forEach(work => {
          this._renderWorkout(work);
        });

        // set edit option to btns and replace data to localstorge
        this._editWorkout();
        this._deleteWorkout();
        this._setLocalStorage();

        // redraw lines

        this._drawLines(this.workouts);
      });
    });
  }

  _deleteWorkout() {
    const BtndeleteWorkout = document.querySelectorAll('.workout__del');
    console.log(this.workouts);
    BtndeleteWorkout.forEach(wo => {
      wo.addEventListener('click', e => {
        const workoutID = e.target.closest('.workout').dataset.id;
        const workoutObj = this.workouts.find(wo => wo.id == workoutID);
        const sureOrNot = prompt('You sure to delet this work out (y / n)?');

        if (sureOrNot === 'y') {
          const workoutindex = this.workouts.indexOf(workoutObj);
          this.workouts.splice(workoutindex, 1);
          this.#map.removeLayer(this.#markers[workoutindex]);
        } else if (sureOrNot === 'n') return;
        else {
          alert("plz enter 'n' or 'y'");
          return;
        }

        // remove all the previose workout, except first
        while (containerWorkouts.children.length > 1) {
          containerWorkouts.removeChild(containerWorkouts.lastChild);
        }

        // render the workouts again after deleting
        this.workouts.forEach(work => {
          this._renderWorkout(work);
        });

        // set edit option to btns and replace data to localstorge
        this._editWorkout();
        this._deleteWorkout();
        this._setLocalStorage();
        window.location.reload();
      });
    });
  }

  _deleteAllWorkout() {
    this.workouts = [];
    this.#markers.forEach(marker => this.#map.removeLayer(marker));
    this.#polylines.forEach(line => this.#map.removeLayer(line));

    while (containerWorkouts.children.length > 1) {
      containerWorkouts.removeChild(containerWorkouts.lastChild);
    }
    this._setLocalStorage();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.workouts = data;

    this.workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
