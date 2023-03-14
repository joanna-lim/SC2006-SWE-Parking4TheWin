from flask import Blueprint, render_template, request, flash, jsonify, redirect, url_for
from flask_login import current_user
from . import db
from .auth import role_required
from .models import *
from .update_carparks import update_carparks_availability, generate_geojson
from datetime import datetime
import json
import os

MAPBOX_SECRET_KEY=os.getenv("MAPBOX_SECRET_KEY")

views = Blueprint('views', __name__)

# driver views here
@views.route('/map', methods=['GET', 'POST'])
@role_required('driver')
def real_home():
    update_carparks_availability()
    generate_geojson()
    with open('website/carparks.json') as f:
        data = json.loads(f.read())
    has_vehicle = False
    vehicles = Vehicle.query.filter_by(user_id = current_user.id).all()
    if vehicles:
        has_vehicle = True
    interested_carpark = current_user.interested_carpark
    return render_template("home.html", user=current_user, MAPBOX_SECRET_KEY=MAPBOX_SECRET_KEY, geojsonData = data, has_vehicle=has_vehicle, interested_carpark=interested_carpark)

@views.route('/', methods=['GET', 'POST'])
@role_required('driver')
def home():
    return render_template("rhome.html", map_path=request.base_url+"map")

@views.route('/coe-registration', methods=['GET', 'POST'])
@role_required('driver')
def coe_registration():
    if request.method == "POST":
        full_name = request.form.get('fullName')
        car_plate = request.form.get('carPlate')
        coe_expiry_html = request.form.get('coeExpiry')
        coe_expiry = datetime.strptime(coe_expiry_html, '%Y-%m-%d').date()

        vehicle =  Vehicle.query.filter_by(car_plate=car_plate).first()
        if vehicle:
            flash('Vehicle with this car plate has already been registered!', category='error')
        else: 
            new_vehicle = Vehicle(full_name=full_name, car_plate=car_plate, coe_expiry=coe_expiry, user_id=current_user.id)
            db.session.add(new_vehicle) 
            db.session.commit()
            flash("Vehicle registered successfully!", "success")
            return redirect(url_for('views.registered_vehicles'))
    return render_template("coe_registration.html", user=current_user)

@views.route('/registered-vehicles', methods=['GET', 'POST'])
@role_required('driver')
def registered_vehicles():
    vehicles = Vehicle.query.filter_by(user_id = current_user.id).all()
    if vehicles:
        return render_template("registered_vehicles.html", user=current_user, vehicles = vehicles)
    else:
        flash("You don't have any vehicles registered with us!", "error")
        return redirect(url_for('views.coe_registration'))

@views.route('/view-rewards', methods=['GET', 'POST'])
@role_required('driver')
def view_rewards():
    rewards = Reward.query.all()
    return render_template("view_rewards.html", user=current_user, rewards=rewards)

# corporate views here
@views.route('/rewards-creation', methods=['GET', 'POST'])
@role_required('corporate')
def rewards_creation():
    if request.method == "POST":
        reward_title = request.form.get('rewardTitle')
        reward_expiry_html = request.form.get('rewardExpiry')
        reward_details = request.form.get('rewardDetails')
        reward_expiry = datetime.strptime(reward_expiry_html, '%Y-%m-%d').date()
        new_reward = Reward(reward_title=reward_title, reward_expiry=reward_expiry, reward_details=reward_details, user_id= current_user.id)
        db.session.add(new_reward) 
        db.session.commit()
        flash('Reward created!', category='success')
    return render_template("rewards_creation.html", user=current_user)

@views.route('/posted-rewards', methods=['GET', 'POST'])
@role_required('corporate')
def posted_rewards():
    rewards = Reward.query.all()
    return render_template("posted_rewards.html", user=current_user, rewards=rewards)

# database related routes
@views.route('/update-interested-carpark', methods=['POST'])
def update_interested_carpark():
    data = json.loads(request.data)
    carpark_address = data['carpark_address']
    carpark = CarPark.query.filter_by(address=carpark_address).first()
    user = User.query.filter_by(id = current_user.id).first()
    # user is removing interest from an old carpark
    if carpark.car_park_no==user.interested_carpark:
        user.interested_carpark = None
        carpark.no_of_interested_drivers-=1
        db.session.commit()
        return jsonify({})
    # user is indicating interest in a new carpark
    elif carpark.car_park_no != user.interested_carpark:
        if user.interested_carpark is not None:
            old_carpark = CarPark.query.filter_by(car_park_no=user.interested_carpark).first()
            old_carpark.no_of_interested_drivers-=1
        user.interested_carpark = carpark.car_park_no
        carpark.no_of_interested_drivers+=1
        db.session.commit()
        return jsonify({})
    else: 
        return jsonify({'success': False})


@views.route('/delete-vehicle', methods=['POST'])
def delete_vehicle():
    vehicle = json.loads(request.data)
    vehicleId = vehicle['vehicleId']
    vehicle = Vehicle.query.get(vehicleId)
    if vehicle:
        if vehicle.user_id == current_user.id:
            db.session.delete(vehicle)
            db.session.commit()
    return jsonify({})

@views.route('/delete-reward', methods=['POST'])
def delete_reward():
    reward = json.loads(request.data)
    rewardId = reward['rewardId']
    reward = Reward.query.get(rewardId)
    if reward:
        if reward.user_id == current_user.id:
            db.session.delete(reward)
            db.session.commit()
    return jsonify({})
