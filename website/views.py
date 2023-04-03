from flask import Blueprint, render_template, request, flash, jsonify, redirect, url_for
from flask_login import current_user
from . import db
from .auth import role_required
from .models import *
from .update_carparks import update_carparks_availability, generate_geojson
from datetime import datetime, date
import json
import os

MAPBOX_SECRET_KEY=os.getenv("MAPBOX_SECRET_KEY")

views = Blueprint('views', __name__)

@views.route('/', methods=['GET'])
@role_required('driver')
def home():
    return redirect(url_for('views.get_map'))

@views.route('/map', methods=['GET'])
@role_required('driver')
def get_map():
    has_vehicle = False
    vehicles = Vehicle.query.filter_by(user_id = current_user.id).all()
    if vehicles:
        has_vehicle = True
    driver = Driver.query.filter_by(user_id = current_user.id).first()
    interested_carpark = driver.interested_carpark
    return render_template("home.html", user=current_user, MAPBOX_SECRET_KEY=MAPBOX_SECRET_KEY, has_vehicle=has_vehicle, interested_carpark=interested_carpark, driver=driver)

#############################
##### Driver views here #####
#############################
@views.route('/coe', methods=['GET'])
@role_required('driver')
def get_coe():
    return render_template("coe_registration.html", user=current_user)

@views.route('/coe', methods=['POST'])
@role_required('driver')
def post_coe():
    full_name = request.form.get('fullName')
    car_plate = request.form.get('carPlate')
    coe_expiry_html = request.form.get('coeExpiry')

    vehicle =  Vehicle.query.filter_by(car_plate=car_plate).first()
    if vehicle:
        flash('Vehicle with this car plate has already been registered!', 'error')

    elif len(full_name) < 1:
        flash('Full name cannot be empty!', 'error')

    # legal limit for full name in Singapore is 54
    elif len(full_name) > 54:
        flash('Full name is too long!', 'error')
    
    elif len('carPlate') < 1:
        flash('Car plate cannot be empty!', 'error')
    
    elif len('carPLate') > 150:
        flash('Car plate is too long!', 'error')
    
    elif len(str(coe_expiry_html)) < 1:
        flash('COE expiry cannot be empty!', 'error')

    elif datetime.strptime(coe_expiry_html, '%Y-%m-%d').date() < date.today():
        flash('COE date input has expired!', 'error')
    
    else: 
        coe_expiry = datetime.strptime(coe_expiry_html, '%Y-%m-%d').date()
        new_vehicle = Vehicle(full_name=full_name, car_plate=car_plate, coe_expiry=coe_expiry, user_id=current_user.id)
        db.session.add(new_vehicle) 
        db.session.commit()
        flash("Vehicle registered successfully!", "success")
        return redirect(url_for('views.get_registered_vehicles'))
    
    return get_coe()

@views.route('/coe/registered_vehicles', methods=['GET'])
@role_required('driver')
def get_registered_vehicles():
    vehicles = Vehicle.query.filter_by(user_id = current_user.id).all()
    if vehicles:
        return render_template("registered_vehicles.html", user=current_user, vehicles = vehicles)
    else:
        flash("You don't have any vehicles registered with us!", "error")
        return redirect(url_for('views.get_coe'))

@views.route('/rewards', methods=['GET'])
def get_rewards():
    if not current_user.is_authenticated:
        # This doesn't work currently
        return render_template(url_for("auth.get_driver_login"))
    if current_user.user_type=="driver":
        rewards = Reward.query.all()
        companies = Company.query.all()
        driver = Driver.query.filter_by(user_id=current_user.id).first()
        user_claimed_rewards_query = UserClaimedRewards.query.filter_by(driver_user_id=current_user.id).all()
        reward_id_list = [reward.reward_id for reward in user_claimed_rewards_query]
        user_claimed_rewards = []
        for id in reward_id_list:
            temp = Reward.query.filter_by(id=id).first()
            user_claimed_rewards.append(temp)
        print(reward_id_list)
        print(user_claimed_rewards)
        return render_template("view_rewards.html", user=current_user, rewards=rewards, companies=companies, driver=driver, user_claimed_rewards=user_claimed_rewards)
    if current_user.user_type=="corporate":
        rewards = Reward.query.all()
        companies = Company.query.all()
        return render_template("posted_rewards.html", user=current_user, rewards=rewards, companies=companies)

@views.route('/rewards', methods=['DELETE'])
@role_required('corporate')
def delete_rewards():
    reward = json.loads(request.data)
    rewardId = reward['rewardId']
    reward = Reward.query.get(rewardId)
    if reward:
        if reward.user_id == current_user.id:
            db.session.delete(reward)
            db.session.commit()
    return jsonify({})

@views.route('/rewards/claim', methods=['POST'])
@role_required('driver')
def claim_reward():
    reward_id = request.form['reward_id']
    reward = Reward.query.get(reward_id)
    driver = Driver.query.filter_by(user_id=current_user.id).first()
    
    # since 1 point =  10 cents, drivers need to have (cost of reward)*10 points
    if driver.points >= reward.cost_of_reward*10 and reward.number_of_rewards > 0:
        driver.points -= (reward.cost_of_reward)*10
        new_claim = UserClaimedRewards(driver_user_id=current_user.id, reward_id=reward_id)
        db.session.add(driver)
        db.session.add(new_claim)
        db.session.commit()

        reward.number_of_rewards -= 1
        db.session.add(reward)
        db.session.commit()

        flash("You have successfully claimed the reward!", "success")
    else:
        flash("Sorry, you do not have enough points to claim this reward!", "error")
    
    return redirect(url_for('views.get_rewards'))

@views.route('/rewards/use', methods=['DELETE'])
def remove_user_rewards():
    print("hello")
    reward = json.loads(request.data)
    rewardId = reward['rewardId']
    reward = UserClaimedRewards.query.filter_by(driver_user_id=current_user.id).filter_by(reward_id=rewardId).first()
    if reward:
        db.session.delete(reward)
        db.session.commit()
        flash("You have successfully used this reward!", "success")
        return jsonify({'status': 'success'})
    else:
        return jsonify({'status': 'error'})
    

################################
##### corporate views here #####
################################

@views.route('/rewards/creation', methods=['GET'])
@role_required('corporate')
def get_rewards_creation():
    return render_template("rewards_creation.html", user=current_user)

@views.route('/rewards/creation', methods=['POST'])
@role_required('corporate')
def post_rewards_creation():
    reward_title = request.form.get('rewardTitle')
    reward_expiry_html = request.form.get('rewardExpiry')
    reward_details = request.form.get('rewardDetails')
    reward_category = request.form.get('rewardCategory')
    number_of_rewards = request.form.get('numberOfRewards')
    cost_of_reward = request.form.get('costOfReward')

    if len(reward_title) > 150: 
        flash('Reward title too long!', 'error')
    
    elif len(reward_title) < 1:
        flash('Reward title cannot be empty!', 'error')
    
    elif len(str(reward_expiry_html)) < 1:
        flash('Expiry date cannot be empty!', 'error')
    
    elif len(str(number_of_rewards)) < 1:
        flash('Number of Rewards cannot be empty!', 'error') 
    
    elif int(number_of_rewards) > 100000:
        flash('Number of rewards is too high!', 'error')
    
    elif len(str(cost_of_reward)) < 1:
        flash('Cost of reward cannot be empty!', 'error')
    
    elif len(reward_details) > 10000:
        flash('Details are too long! Max 10,000 characters', 'error')
    
    elif int(cost_of_reward) > 1000000:
        flash('Cost of reward is too high!', 'error')
    
    else: 
        reward_expiry = datetime.strptime(reward_expiry_html, '%Y-%m-%d').date()
        new_reward = Reward(reward_title=reward_title, reward_expiry=reward_expiry, reward_details=reward_details, user_id= current_user.id, reward_category=reward_category, number_of_rewards=number_of_rewards, cost_of_reward=cost_of_reward)
        db.session.add(new_reward) 
        db.session.commit()
        flash('Reward created!', category='success')

    return get_rewards_creation()

@views.route('/points', methods=['GET'])
@role_required('driver')
def get_points():
    driver = Driver.query.filter_by(user_id=current_user.id).first()
    return render_template("claim_points.html", user=current_user, driver = driver)

@views.route('/points', methods=['PUT'])
@role_required('driver')
def put_points():
    request_body = json.loads(request.data)
    points_change = int(request_body["points_change"])  # Can also be negative
    driver = Driver.query.filter_by(user_id = current_user.id).first()
    driver.points += points_change
    db.session.commit()
    return jsonify({})

@views.route('/vehicles', methods=['DELETE'])
def delete_vehicles():
    vehicle = json.loads(request.data)
    vehicleId = vehicle['vehicleId']
    vehicle = Vehicle.query.get(vehicleId)
    if vehicle:
        if vehicle.user_id == current_user.id:
            db.session.delete(vehicle)
            db.session.commit()
    return jsonify({})

@views.route('/drivers', methods=['PUT'])
@role_required('driver')
def put_drivers():
    data = json.loads(request.data)
    driver = Driver.query.filter_by(user_id = current_user.id).first()
    intent = data["intent"]

    if intent == "update_interested_carpark":
        carpark_address = data['carpark_address']
        carpark = CarPark.query.filter_by(address=carpark_address).first()

        # user is removing interest from an old carpark
        # op_type = 0 means user is removing interest
        if carpark.car_park_no==driver.interested_carpark:
            driver.interested_carpark = None
            carpark.no_of_interested_drivers-=1
            op_type = 0
        # user is indicating interest in a new carpark
        # op_type = 1 means user is indicating interest
        elif carpark.car_park_no != driver.interested_carpark:
            if driver.interested_carpark is not None:
                old_carpark = CarPark.query.filter_by(car_park_no=driver.interested_carpark).first()
                old_carpark.no_of_interested_drivers-=1
            driver.interested_carpark = carpark.car_park_no
            carpark.no_of_interested_drivers+=1
            op_type = 1

        db.session.commit()
        generate_geojson()
        with open('website/carparks.json') as f:
            data = json.loads(f.read())
        return jsonify(success=True, op_type = op_type, updatedgeojsondata=data)
    
    if intent == "delete_interested_carpark":
        # Do verification of parking image here
        # The prototype won't implement this.
        carpark = CarPark.query.filter_by(car_park_no=driver.interested_carpark).first()
        carpark.no_of_interested_drivers-=1

        driver.interested_carpark = None
        driver.points += 1

        flash("Thanks for uploading,\n you've received 1 point!")
        db.session.commit()
        generate_geojson()
        return redirect(url_for("views.get_map"))

@views.route('/parking_verification', methods=['GET'])
@role_required('driver')
def get_parking_verification():
    # Users should not be able to use this route if they don't have any
    # interested carparks
    driver = Driver.query.filter_by(user_id = current_user.id).first()
    if driver.interested_carpark is None:
        #flash("You don't have any interested carpark!", "error")
        return redirect(url_for("views.get_map"))

    if request.method == "GET":
        return render_template("verify_parking.html", user=current_user)

# Returns geojson data
@views.route("/carparks", methods=["GET"])
@role_required("driver")
def get_carparks():
    with open('website/carparks.json') as f:
        data = json.loads(f.read())
    return jsonify(data)